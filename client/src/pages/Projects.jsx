import React, { useEffect, useState, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import FilterModal from '../components/FilterModal';
import ActiveFilterBar from '../components/ActiveFilterBar';
import { exportToCSV } from '../utils/exportUtils';
import { smartSearch } from '../utils/searchUtils';
import '../styles/table_layout.css';
import '../styles/project.css';
import '../styles/modal.css';

export default function Projects() {
  const { user, isLoggingOut } = useAuth();
  const { showSuccess, showError } = useAlert();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({ status: 'all', client: 'all', allocation: 'all' });

  // New Project State
  const [newProject, setNewProject] = useState({
    name: '',
    client_name: '',
    manager_name: '',
    status: 'active'
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Fire both queries in parallel — eliminates the sequential waterfall
      const [{ data: allItems }, projectsResult] = await Promise.all([
        supabase.from('items').select('project'),
        supabase.from('projects').select('*').order('created_at', { ascending: false })
      ]);

      let dbProjects = [];
      if (projectsResult.error) {
        console.warn('Projects table error or missing, fallback to unique items:', projectsResult.error);
      } else {
        dbProjects = projectsResult.data || [];
      }

      // Fallback: if projects table is empty, extract from items catalog
      if (dbProjects.length === 0 && allItems && allItems.length > 0) {
        const uniqueProjNames = Array.from(new Set(allItems.map(i => i.project).filter(Boolean)));
        dbProjects = uniqueProjNames.map((name, idx) => ({
          id: `proj-${idx + 1}`,
          name: name,
          client: name === 'BDU-DCF' ? 'Bahir Dar University' : 'CIH Partner',
          manager: 'Letera Tadele',
          status: 'active'
        }));
      }

      // Map projects with dynamic counts and unified keys
      const mapped = dbProjects.map(proj => {
        const pName = (proj.name || '').trim().toLowerCase();
        const count = (allItems || []).filter(i => (i.project || '').trim().toLowerCase() === pName).length;
        return {
          ...proj,
          client: proj.client || proj.client_name || 'CIH Partner',
          manager: proj.manager || proj.manager_name || 'Letera Tadele',
          status: proj.status || 'active',
          itemCount: count
        };
      });

      if (isMountedRef.current) {
        setProjects(mapped);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('[Projects] Fetch error:', err);
        showError('Failed to load projects: ' + (err.message || 'Database error'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [showError]);

  useEffect(() => {
    if (!user) return;
    fetchProjects();
  }, [user, fetchProjects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCriteria]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCriteria.status && filterCriteria.status !== 'all') count++;
    if (filterCriteria.client && filterCriteria.client !== 'all') count++;
    if (filterCriteria.allocation && filterCriteria.allocation !== 'all') count++;
    return count;
  }, [filterCriteria]);

  // Filter projects by status, client, and item allocation
  const activeProjects = useMemo(() => {
    return projects.filter(proj => {
      // Status filter
      if (filterCriteria.status && filterCriteria.status !== 'all') {
        const pStatus = (proj.status || '').toLowerCase();
        if (filterCriteria.status === 'active' && pStatus !== 'active' && pStatus !== 'in_progress') return false;
        if (filterCriteria.status === 'in_progress' && pStatus !== 'in_progress') return false;
        if (filterCriteria.status === 'completed' && pStatus !== 'completed') return false;
      }
      // Partner / Client filter
      if (filterCriteria.client && filterCriteria.client !== 'all') {
        const pClient = (proj.client || proj.client_name || '').trim();
        if (pClient !== filterCriteria.client) return false;
      }
      // Allocation filter
      if (filterCriteria.allocation && filterCriteria.allocation !== 'all') {
        if (filterCriteria.allocation === 'with_items' && (!proj.itemCount || proj.itemCount <= 0)) return false;
        if (filterCriteria.allocation === 'empty' && proj.itemCount > 0) return false;
      }
      return true;
    });
  }, [projects, filterCriteria]);

  const deferredSearch = useDeferredValue(search);

  // Ambiguity-resilient fuzzy search
  const filteredProjects = useMemo(() => {
    return smartSearch(activeProjects, deferredSearch, p => [
      p.name || '',
      p.client || '',
      p.manager || '',
      p.status || ''
    ]);
  }, [activeProjects, deferredSearch]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  if (!user) {
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  const handleRemoveFilter = (filterKey) => {
    setFilterCriteria(prev => ({ ...prev, [filterKey]: 'all' }));
  };

  const handleClearAllFilters = () => {
    setFilterCriteria({ status: 'all', client: 'all', allocation: 'all' });
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    setSubmitting(true);
    try {
      // Attempt insert with client and manager columns
      const insertData = {
        name: newProject.name.trim(),
        client: newProject.client_name.trim() || 'Internal Lab',
        manager: newProject.manager_name.trim() || 'Lab Lead',
        status: newProject.status || 'active'
      };

      let { error } = await supabase.from('projects').insert([insertData]);

      // If column client or manager doesn't exist, try client_name/manager_name
      if (error && (error.message.includes('column') || error.message.includes('does not exist'))) {
        const altData = {
          name: newProject.name.trim(),
          client_name: newProject.client_name.trim() || 'Internal Lab',
          manager_name: newProject.manager_name.trim() || 'Lab Lead',
          status: newProject.status || 'active'
        };
        const altRes = await supabase.from('projects').insert([altData]);
        error = altRes.error;
      }

      if (error) throw error;

      await showSuccess('Project created successfully!');
      await fetchProjects();
      setIsAddModalOpen(false);
      setNewProject({
        name: '',
        client_name: '',
        manager_name: '',
        status: 'active'
      });
    } catch (err) {
      showError('Error creating project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const cols = [
      { key: 'name', label: 'Project Name' },
      { key: 'client', label: 'Client' },
      { key: 'manager', label: 'Project Manager' },
      { key: 'status', label: 'Status' },
      { key: 'itemCount', label: 'Items Associated' }
    ];
    exportToCSV(filteredProjects, cols, 'cih-projects-directory');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar onSearch={(e) => setSearch(e.target.value)} />

        <div className="projects-container">
          <div className="table-toolbar" style={{ padding: '20px 0' }}>
            <div className="toolbar-actions">
              <button 
                className="action-btn primary" 
                onClick={() => setIsAddModalOpen(true)}
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>add_circle</span> Add Project
              </button>
              <button className="action-btn primary" onClick={handleExport} style={{ cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>download</span> Export
              </button>
              <button 
                className={`action-btn ${activeFilterCount > 0 ? 'primary' : ''}`}
                onClick={() => setIsFilterModalOpen(true)}
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>filter_alt</span> 
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          </div>

          <ActiveFilterBar
            filters={filterCriteria}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />

          <div className="projects-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div className="project-card" key={`skel-proj-${idx}`} style={{ pointerEvents: 'none' }}>
                  <div className="project-info">
                    <div className="project-info-row" style={{ justifyContent: 'space-between' }}>
                      <div style={{ width: '70%' }}>
                        <span className="skeleton-box skeleton-text" style={{ width: '85%', height: '18px', marginBottom: '8px' }}></span>
                        <span className="skeleton-box skeleton-text" style={{ width: '55%', height: '14px' }}></span>
                      </div>
                      <span className="skeleton-box skeleton-badge" style={{ width: '60px', height: '22px' }}></span>
                    </div>
                  </div>
                  <div className="team-members-row" style={{ marginTop: '16px' }}>
                    <div className="team-member" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className="skeleton-box" style={{ width: '38px', height: '38px', borderRadius: '50%' }}></span>
                      <div style={{ flex: 1 }}>
                        <span className="skeleton-box skeleton-text" style={{ width: '60%', height: '14px', marginBottom: '4px' }}></span>
                        <span className="skeleton-box skeleton-text" style={{ width: '40%', height: '12px' }}></span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '14px' }}>
                    <span className="skeleton-box skeleton-text" style={{ width: '45%', height: '14px', marginBottom: '8px' }}></span>
                    <span className="skeleton-box" style={{ width: '100%', height: '6px', borderRadius: '4px' }}></span>
                  </div>
                </div>
              ))
            ) : (
              <>
                {paginatedProjects.map(project => {
                  const initials = (project.manager || 'LT')
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  const isCompleted = project.status === 'completed';

                  return (
                    <Link 
                      to={`/project_detail?name=${encodeURIComponent(project.name)}${project.id ? `&id=${project.id}` : ''}`} 
                      className="project-card" 
                      key={project.id || project.name}
                    >
                      <div className="project-info">
                        <div className="project-info-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div className="project-info-row">
                              <span className="project-label">Project:</span>
                              <span className="project-value">{project.name}</span>
                            </div>
                            <div className="project-info-row">
                              <span className="project-label">Client:</span>
                              <span className="client-value">{project.client}</span>
                            </div>
                          </div>
                          <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                            {isCompleted ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d1fae5', color: '#065f46', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span> Completed
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dbeafe', color: '#1e40af', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bolt</span> Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="team-members-row">
                        <div className="team-member">
                          <div className="member-avatar">{initials}</div>
                          <div className="member-details">
                            <span className="member-name">{project.manager}</span>
                            <span className="member-role">Project Manager</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#64748b', margin: '12px 0 6px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px' }}>inventory_2</span>
                        <span><strong>{project.itemCount}</strong> items associated</span>
                      </div>

                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: isCompleted ? '100%' : '60%', 
                            background: isCompleted ? '#10b981' : 'var(--primary-color)' 
                          }}
                        />
                      </div>
                    </Link>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 2rem', color: '#64748b' }}>
                    No projects found.
                  </div>
                )}
              </>
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalRecords={filteredProjects.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[6, 12, 24, 48]}
          />
        </div>
      </main>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={setFilterCriteria}
        currentFilters={filterCriteria}
        mode="projects"
        projects={projects}
      />

      {/* Add Project Modal */}
      {isAddModalOpen && (
        <div className="side-modal-overlay open" style={{ display: 'flex', zIndex: 9999 }} onClick={() => setIsAddModalOpen(false)}>
          <div className="side-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Project</h2>
              <button 
                type="button" 
                className="close-btn" 
                onClick={() => setIsAddModalOpen(false)} 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="modal-body">
              <div className="form-grid" style={{ marginTop: '10px' }}>
                <div className="form-group">
                  <label>Project Name <span className="required">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Enter project name" 
                    required 
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Client Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter client name (e.g. Bahir Dar University)" 
                    value={newProject.client_name}
                    onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Project Manager</label>
                  <input 
                    type="text" 
                    placeholder="Enter manager name (e.g. Letera Tadele)" 
                    value={newProject.manager_name}
                    onChange={(e) => setNewProject({ ...newProject, manager_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select 
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '20px 0 0 0', marginTop: '20px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary modal-btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
