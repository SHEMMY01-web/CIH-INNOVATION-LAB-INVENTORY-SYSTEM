import React, { useState, useEffect, useRef } from 'react';
import { supabase, invalidateApiCache } from '../lib/supabase';
import { HARDWARE_CATEGORIES, getStructuredItemType } from '../utils/inventoryClassifier';
import { useAlert } from '../contexts/AlertContext';
import { slugify, getItemImage as getDefaultItemImage } from '../utils/slugify';

export default function EditItemModal({ isOpen, onClose, item, onUpdated, onDeleted }) {
  const { showSuccess, showError, showWarning, showConfirm } = useAlert();
  const [formData, setFormData] = useState({
    item_name: '',
    model: '',
    type: '',
    amount: 1,
    status: 'available',
    store: 'pcs',
    perfectly_working: 0,
    not_working: 0,
    to_be_received: 0,
    supplier: '',
    project: '',
    image_url: ''
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (item) {
      const initialImg = item.image_url || getDefaultItemImage(item) || '';
      const resolvedType = (item.type && item.type !== 'item:-' && item.type !== 'item:general' && item.type !== '-') 
        ? item.type 
        : getStructuredItemType(item);
      setFormData({
        item_name: item.item_name || '',
        model: item.model && item.model !== '-' ? item.model : '',
        type: resolvedType,
        amount: item.amount ?? 1,
        status: item.status || 'available',
        store: item.store || 'pcs',
        perfectly_working: item.perfectly_working ?? 0,
        not_working: item.not_working ?? 0,
        to_be_received: item.to_be_received ?? 0,
        supplier: item.supplier || '',
        project: item.project || '',
        image_url: item.image_url || ''
      });
      setImagePreview(initialImg);
    }
  }, [item]);

  // Handle ESC key to dismiss modal (WCAG 2.1 AA)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showWarning('Image file size must be under 8MB', 'File Too Large');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Show preview immediately while the upload runs asynchronously
        const previewDataUrl = canvas.toDataURL('image/webp', 0.88);
        setImagePreview(previewDataUrl);

        // Upload binary Blob to Supabase Storage — keeps the DB column lean (URL only)
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setFormData(prev => ({ ...prev, image_url: previewDataUrl }));
            return;
          }

          try {
            const safeName = (formData.item_name || item?.item_name || 'item')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            const filePath = `items/${safeName}-${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
              .from('inventory-images')
              .upload(filePath, blob, {
                contentType: 'image/jpeg',
                cacheControl: '31536000',
                upsert: true
              });

            if (uploadError) {
              // Bucket not configured or network error — fall back gracefully
              console.warn('[EditItemModal] Storage upload failed:', uploadError.message);
              setFormData(prev => ({ ...prev, image_url: previewDataUrl }));
              return;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('inventory-images')
              .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, image_url: publicUrl }));
          } catch (err) {
            console.warn('[EditItemModal] Storage upload exception:', err.message);
            setFormData(prev => ({ ...prev, image_url: previewDataUrl }));
          }
        }, 'image/jpeg', 0.82);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };


  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_name.trim()) {
      showWarning('Item name is required!', 'Missing Field');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        item_name: formData.item_name.trim(),
        model: formData.model.trim() || '-',
        type: formData.type.trim() || item.type || 'item:general',
        amount: Number(formData.amount) || 0,
        status: formData.status,
        store: formData.store || 'pcs',
        perfectly_working: Number(formData.perfectly_working) || 0,
        not_working: Number(formData.not_working) || 0,
        to_be_received: Number(formData.to_be_received) || 0,
        supplier: formData.supplier.trim() || '',
        project: formData.project.trim() || '',
        image_url: formData.image_url || ''
      };

      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', item.id)
        .select();

      if (error) throw error;

      invalidateApiCache();
      await showSuccess('Item updated successfully!');
      if (onUpdated) onUpdated(data?.[0] || { ...item, ...updates });
      onClose();
    } catch (err) {
      showError('Failed to update item: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Inventory Item',
      message: `Are you sure you want to delete "${item.item_name}"? This action cannot be undone.`,
      confirmText: 'Delete Item',
      cancelText: 'Keep Item',
      isDanger: true
    });

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      invalidateApiCache();
      await showSuccess('Item deleted successfully!');
      if (onDeleted) onDeleted(item.id);
      onClose();
    } catch (err) {
      showError('Failed to delete item: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div 
      className="side-modal-overlay open" 
      style={{ display: 'flex', zIndex: 9999 }}
      onClick={onClose}
    >
      <div 
        className="side-modal-panel" 
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-item-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '660px', 
          maxWidth: '94vw',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(28, 33, 223, 0.08)',
              color: 'var(--primary-color, #1c21df)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>edit_note</span>
            </div>
            <div>
              <h2 id="edit-item-modal-title" style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>Edit Item Details</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Update inventory specifications, image, stock & condition
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="close-btn" 
            onClick={onClose}
            aria-label="Close"
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: '28px',
              lineHeight: 1,
              padding: '4px',
              color: 'var(--text-secondary)',
              transition: 'color 0.2s'
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body with spacious scrolling container */}
        <div className="modal-body" style={{ padding: '28px 32px', flex: 1, overflowY: 'auto' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Section 1: Item Photo / Asset Image */}
            <div style={{
              background: 'var(--topbar-bg, #f8fafc)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '18px 20px'
            }}>
              <label style={{ 
                display: 'block', 
                fontWeight: 600, 
                fontSize: '0.92rem', 
                marginBottom: '10px',
                color: 'var(--text-color)' 
              }}>
                Item Photo / Asset Image
              </label>

              <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '10px',
                  border: '2px dashed var(--border-color, #cbd5e1)',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Item preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#94a3b8' }}>
                      image
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="action-btn"
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload</span>
                      Upload from Device
                    </button>

                    {imagePreview && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        style={{
                          padding: '8px 12px',
                          fontSize: '0.85rem',
                          color: '#ef4444',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                        Remove
                      </button>
                    )}
                  </div>

                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageFileChange}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0 }}>Or URL:</span>
                    <input 
                      type="text"
                      placeholder="https://example.com/image.png"
                      value={formData.image_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({ ...prev, image_url: val }));
                        setImagePreview(val);
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        color: 'var(--text-color)',
                        flex: 1
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Upload any photo directly from your device. Auto-optimized to standard 600x600 WebP.
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: General Identification */}
            <div>
              <h4 style={{ 
                margin: '0 0 14px 0', 
                fontSize: '0.9rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                color: 'var(--primary-color, #1c21df)'
              }}>
                1. General Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Item Name <span className="required">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder="e.g. Arduino Uno R3, Ultrasonic Sensor"
                    style={{ fontSize: '0.95rem', fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
                <div className="form-group">
                  <label>Model / Serial Number</label>
                  <input 
                    type="text" 
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g. HC-SR04, Rev 3"
                  />
                </div>

                <div className="form-group">
                  <label>Type / Domain Classification</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    {formData.type && !HARDWARE_CATEGORIES.some(cat => formData.type.endsWith(cat)) && (
                      <option value={formData.type}>{formData.type}</option>
                    )}
                    {HARDWARE_CATEGORIES.map(cat => {
                      const prefix = (item?.type || '').toLowerCase().startsWith('asset:') ? 'asset:' : (item?.type || '').toLowerCase().startsWith('tool:') ? 'tool:' : 'item:';
                      const val = `${prefix}${cat}`;
                      return (
                        <option key={val} value={val}>
                          {cat} ({prefix.replace(':', '')})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Stock & Availability */}
            <div>
              <h4 style={{ 
                margin: '0 0 14px 0', 
                fontSize: '0.9rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                color: 'var(--primary-color, #1c21df)'
              }}>
                2. Stock & Status
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Total Quantity <span className="required">*</span></label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Unit of Measure</label>
                  <input 
                    type="text" 
                    value={formData.store}
                    onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                    placeholder="pcs, box, meters"
                  />
                </div>

                <div className="form-group">
                  <label>Availability Status <span className="required">*</span></label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="Out of Stock">Out of Stock</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Condition Breakdown */}
            <div>
              <h4 style={{ 
                margin: '0 0 14px 0', 
                fontSize: '0.9rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                color: 'var(--primary-color, #1c21df)'
              }}>
                3. Condition Breakdown
              </h4>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: '14px',
                background: 'var(--topbar-bg, #f8fafc)',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #e2e8f0)'
              }}>
                <div className="form-group">
                  <label style={{ color: '#10b981', fontWeight: 600 }}>✓ Working</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.perfectly_working}
                    onChange={(e) => setFormData({ ...formData, perfectly_working: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ color: '#ef4444', fontWeight: 600 }}>⚠ Not Working</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.not_working}
                    onChange={(e) => setFormData({ ...formData, not_working: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ color: '#ea580c', fontWeight: 600 }}>⏳ To Be Received</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.to_be_received}
                    onChange={(e) => setFormData({ ...formData, to_be_received: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Assignment & Supplier */}
            <div>
              <h4 style={{ 
                margin: '0 0 14px 0', 
                fontSize: '0.9rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                color: 'var(--primary-color, #1c21df)'
              }}>
                4. Assignment & Procurement
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Supplier</label>
                  <input 
                    type="text" 
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="e.g. Roboshop, Adafruit"
                  />
                </div>

                <div className="form-group">
                  <label>Assigned Project</label>
                  <input 
                    type="text" 
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    placeholder="Leave blank for general lab stock"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer with Brand-Aligned Buttons */}
            <div style={{ 
              paddingTop: '20px', 
              marginTop: '10px', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                {deleting ? 'Deleting...' : 'Delete Item'}
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  className="action-btn"
                  onClick={onClose}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="action-btn primary"
                  disabled={saving}
                  style={{
                    background: 'var(--primary-color, #1c21df)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(28, 33, 223, 0.25)'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                  {saving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
