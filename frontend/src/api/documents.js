import client from './client';

export const documentsApi = {
  // Get all documents
  getAll: () => client.get('/documents/'),
  
  // Get single document
  getById: (docId) => client.get(`/documents/${docId}`),
  
  // Create new document
  create: (data) => client.post('/documents/', data),
  
  // Update document with version control
  update: (docId, content, baseVersionId = null, changeSummary = '') => 
    client.put(`/documents/${docId}`, {
      content,
      base_version_id: baseVersionId,
      change_summary: changeSummary
    }),
  
  // Delete document
  delete: (docId) => client.delete(`/documents/${docId}`),

  // Share document access with another registered user
  getCollaborators: (docId) => client.get(`/documents/${docId}/collaborators`),
  addCollaborator: (docId, email, permission = 'edit') =>
    client.post(`/documents/${docId}/collaborators`, { email, permission }),
};

export const versionsApi = {
  // Get version history
  getHistory: (docId, page = 1, perPage = 20) => 
    client.get(`/versions/document/${docId}`, {
      params: { page, per_page: perPage }
    }),
  
  // Get specific version
  getVersion: (versionId) => client.get(`/versions/${versionId}`),
  
  // Get diff between versions
  getDiff: (versionId1, versionId2) => 
    client.get(`/versions/${versionId1}/diff/${versionId2}`),
  
  // Rollback to version
  rollback: (docId, versionId) => 
    client.post(`/versions/document/${docId}/rollback/${versionId}`),
};

export const authApi = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  register: (name, email, password) => client.post('/auth/register', { name, email, password }),
  logout: () => client.post('/auth/logout'),
  getCurrentUser: () => client.get('/auth/me'),
  refreshToken: () => client.post('/auth/refresh'),
};
