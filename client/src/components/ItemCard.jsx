import React, { useState, useEffect } from 'react';

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export default function ItemCard({ item }) {
  const rawType = item.type || '';
  let displayType = 'General Item';
  let categoryIcon = 'inventory_2';

  const lowerType = rawType.toLowerCase();
  const lowerName = (item.item_name || '').toLowerCase();

  if (lowerType.startsWith('asset:')) {
    const sub = rawType.split(':')[1]?.trim();
    displayType = sub && sub !== '-' ? `Asset • ${sub.toUpperCase()}` : 'Heavy Asset';
    categoryIcon = 'devices';
  } else if (lowerType.startsWith('tool:')) {
    const sub = rawType.split(':')[1]?.trim();
    displayType = sub && sub !== '-' ? `Tool • ${sub}` : 'Lab Tool';
    categoryIcon = 'build';
  } else if (lowerType.startsWith('item:')) {
    const sub = rawType.split(':')[1]?.trim();
    displayType = sub && sub !== '-' ? sub : 'General Item';
    categoryIcon = 'inventory_2';
  } else if (rawType && rawType !== '-') {
    displayType = rawType;
  }

  // Specific contextual icons based on item name
  if (lowerName.includes('sensor')) categoryIcon = 'sensors';
  else if (lowerName.includes('solar')) categoryIcon = 'solar_power';
  else if (lowerName.includes('relay') || lowerName.includes('board') || lowerName.includes('micro') || lowerName.includes('chip')) categoryIcon = 'memory';
  else if (lowerName.includes('laptop') || lowerName.includes('lap') || lowerName.includes('monitor')) categoryIcon = 'laptop_mac';
  else if (lowerName.includes('cable') || lowerName.includes('wire')) categoryIcon = 'cable';
  else if (lowerName.includes('battery') || lowerName.includes('power')) categoryIcon = 'battery_charging_full';

  const isAvailable = (item.amount > 0) && (item.status !== 'Out of Stock') && (item.status !== 'Damaged');
  
  let statusText = 'Available';
  if (!isAvailable) {
    statusText = 'Unavailable';
    if (item.status === 'Out of Stock') statusText = 'Out of Stock';
    else if (item.status === 'Damaged') statusText = 'Damaged';
  }

  const slug = slugify(item.item_name);
  const candidateUrl = item.image_url || (slug ? `/IMAGES/items/${slug}.webp` : null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [candidateUrl]);

  return (
    <div className="item-card">
      <div className="card-image-container">
        {candidateUrl && !imgError ? (
          <img 
            src={candidateUrl} 
            alt={item.item_name || 'Item image'} 
            className="card-image" 
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-image-fallback">
            <div className="fallback-icon-wrap">
              <span className="material-symbols-outlined">{categoryIcon}</span>
            </div>
            <span className="fallback-type-pill">{displayType}</span>
          </div>
        )}
      </div>
      <div className="card-content">
        <span className="card-type">{displayType}</span>
        <h3 className="card-title">{item.item_name || 'Unnamed Item'}</h3>
        <p className="card-model">{item.model && item.model !== '-' ? item.model : 'Standard Lab Stock'}</p>
        
        <div className="card-footer">
          <div className={`status-badge ${isAvailable ? 'available' : 'unavailable'}`}>
            <div className="status-dot"></div>
            {statusText}
          </div>
          <div className="qty-info">
            {item.amount || 0} <span>{item.store || 'pcs'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
