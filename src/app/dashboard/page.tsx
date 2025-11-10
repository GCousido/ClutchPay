'use client';

import { useEffect, useState } from 'react';

type EntityType = 'users' | 'invoices' | 'payments' | 'notifications';

type User = {
  id: number;
  email: string;
  name: string;
  surnames: string;
  phone?: string | null;
  country?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: User[];
  notifications?: Notification[];
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  issuerUserId: number;
  debtorUserId: number;
  subject: string;
  description: string;
  amount: number;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  invoicePdfUrl: string;
  createdAt: string;
  updatedAt: string;
};

type Payment = {
  id: number;
  invoiceId: number;
  paymentDate: string;
  paymentMethod: string;
  paymentReference?: string | null;
  receiptPdfUrl: string;
  subject?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Notification = {
  id: number;
  userId: number;
  invoiceId: number;
  type: string;
  read: boolean;
  createdAt: string;
};

type Entity = User | Invoice | Payment | Notification;

function Dashboard() {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('users');
  const [data, setData] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [viewModal, setViewModal] = useState<Entity | null>(null);
  const [editModal, setEditModal] = useState<Entity | null>(null);
  const [deleteModal, setDeleteModal] = useState<Entity | null>(null);
  const [createModal, setCreateModal] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [createFormData, setCreateFormData] = useState<Record<string, any>>({});

  // User details states
  const [userContacts, setUserContacts] = useState<User[]>([]);
  const [userNotifications, setUserNotifications] = useState<Notification[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactId, setNewContactId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${selectedEntity}?limit=1000`, { credentials: 'include' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Failed to fetch data');
      setData(body?.data ?? body);
    } catch (err: any) {
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedEntity]);

  const fetchUserDetails = async (userId: number) => {
    try {
      // Fetch contacts
      const contactsRes = await fetch(`/api/users/${userId}/contacts`, { credentials: 'include' });
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setUserContacts(contactsData?.data ?? contactsData);
      }

      // Fetch user notifications
      const notifRes = await fetch(`/api/notifications?userId=${userId}`, { credentials: 'include' });
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setUserNotifications(notifData?.data ?? notifData);
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
    }
  };

  const handleViewUser = (user: Entity) => {
    setViewModal(user);
    if (selectedEntity === 'users') {
      fetchUserDetails((user as User).id);
    }
  };

  const handleEdit = (item: Entity) => {
    setEditModal(item);
    setEditFormData({ ...item });
  };

  const handleEditSubmit = async () => {
    if (!editModal) return;
    try {
      const res = await fetch(`/api/${selectedEntity}/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editFormData),
      });
      if (!res.ok) throw new Error('Failed to update');
      setEditModal(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      const res = await fetch(`/api/${selectedEntity}/${deleteModal.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteModal(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreate = () => {
    setCreateFormData({});
    setCreateModal(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const res = await fetch(`/api/${selectedEntity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createFormData),
      });
      if (!res.ok) throw new Error('Failed to create');
      setCreateModal(false);
      setCreateFormData({});
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddContact = async () => {
    if (!viewModal || !newContactId) return;
    try {
      const res = await fetch(`/api/users/${(viewModal as User).id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contactId: parseInt(newContactId) }),
      });
      if (!res.ok) throw new Error('Failed to add contact');
      setNewContactId('');
      setShowAddContact(false);
      fetchUserDetails((viewModal as User).id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMarkNotificationRead = async (notificationId: number) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ read: true }),
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      if (viewModal) {
        fetchUserDetails((viewModal as User).id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!viewModal) return;
    try {
      const userId = (viewModal as User).id;
      // Mark all unread notifications for this user
      const unreadNotifs = userNotifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifs.map(n => 
          fetch(`/api/notifications/${n.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ read: true }),
          })
        )
      );
      fetchUserDetails(userId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const renderTableHeaders = () => {
    switch (selectedEntity) {
      case 'users':
        return ['ID', 'Email', 'Name', 'Surnames', 'Phone', 'Country', 'Actions'];
      case 'invoices':
        return ['ID', 'Invoice #', 'Subject', 'Amount', 'Status', 'Issue Date', 'Actions'];
      case 'payments':
        return ['ID', 'Invoice ID', 'Payment Date', 'Method', 'Reference', 'Actions'];
      case 'notifications':
        return ['ID', 'User ID', 'Invoice ID', 'Type', 'Read', 'Created', 'Actions'];
      default:
        return ['ID', 'Actions'];
    }
  };

  const renderTableRow = (item: Entity) => {
    const baseActions = (
      <div className="flex gap-2">
        <button
          onClick={() => handleViewUser(item)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          View
        </button>
        <button
          onClick={() => handleEdit(item)}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          Edit
        </button>
        <button
          onClick={() => setDeleteModal(item)}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
        >
          Delete
        </button>
      </div>
    );

    switch (selectedEntity) {
      case 'users': {
        const u = item as User;
        return (
          <>
            <td className="px-4 py-2 border">{u.id}</td>
            <td className="px-4 py-2 border">{u.email}</td>
            <td className="px-4 py-2 border">{u.name}</td>
            <td className="px-4 py-2 border">{u.surnames}</td>
            <td className="px-4 py-2 border">{u.phone ?? '—'}</td>
            <td className="px-4 py-2 border">{u.country ?? '—'}</td>
            <td className="px-4 py-2 border">{baseActions}</td>
          </>
        );
      }
      case 'invoices': {
        const inv = item as Invoice;
        return (
          <>
            <td className="px-4 py-2 border">{inv.id}</td>
            <td className="px-4 py-2 border">{inv.invoiceNumber}</td>
            <td className="px-4 py-2 border">{inv.subject}</td>
            <td className="px-4 py-2 border">${inv.amount}</td>
            <td className="px-4 py-2 border">{inv.status}</td>
            <td className="px-4 py-2 border">{new Date(inv.issueDate).toLocaleDateString()}</td>
            <td className="px-4 py-2 border">{baseActions}</td>
          </>
        );
      }
      case 'payments': {
        const p = item as Payment;
        return (
          <>
            <td className="px-4 py-2 border">{p.id}</td>
            <td className="px-4 py-2 border">{p.invoiceId}</td>
            <td className="px-4 py-2 border">{new Date(p.paymentDate).toLocaleDateString()}</td>
            <td className="px-4 py-2 border">{p.paymentMethod}</td>
            <td className="px-4 py-2 border">{p.paymentReference ?? '—'}</td>
            <td className="px-4 py-2 border">{baseActions}</td>
          </>
        );
      }
      case 'notifications': {
        const n = item as Notification;
        return (
          <>
            <td className="px-4 py-2 border">{n.id}</td>
            <td className="px-4 py-2 border">{n.userId}</td>
            <td className="px-4 py-2 border">{n.invoiceId}</td>
            <td className="px-4 py-2 border">{n.type}</td>
            <td className="px-4 py-2 border">{n.read ? 'Yes' : 'No'}</td>
            <td className="px-4 py-2 border">{new Date(n.createdAt).toLocaleDateString()}</td>
            <td className="px-4 py-2 border">{baseActions}</td>
          </>
        );
      }
      default:
        return (
          <>
            <td className="px-4 py-2 border">{item.id}</td>
            <td className="px-4 py-2 border">{baseActions}</td>
          </>
        );
    }
  };

  const renderEditForm = () => {
    if (!editModal) return null;
    const fields = Object.keys(editFormData).filter((k) => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');

    return (
      <div className="space-y-3">
        {fields.map((field) => (
          <label key={field} className="block">
            <span className="text-sm font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
            <input
              type="text"
              value={editFormData[field] ?? ''}
              onChange={(e) => setEditFormData({ ...editFormData, [field]: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
            />
          </label>
        ))}
      </div>
    );
  };

  const getCreateFields = () => {
    switch (selectedEntity) {
      case 'users':
        return ['email', 'name', 'surnames', 'password', 'phone', 'country', 'imageUrl'];
      case 'invoices':
        return ['invoiceNumber', 'issuerUserId', 'debtorUserId', 'subject', 'description', 'amount', 'status', 'issueDate', 'dueDate', 'invoicePdfUrl'];
      case 'payments':
        return ['invoiceId', 'paymentDate', 'paymentMethod', 'paymentReference', 'receiptPdfUrl', 'subject'];
      case 'notifications':
        return ['userId', 'invoiceId', 'type'];
      default:
        return [];
    }
  };

  const renderCreateForm = () => {
    const fields = getCreateFields();

    return (
      <div className="space-y-3">
        {fields.map((field) => (
          <label key={field} className="block">
            <span className="text-sm font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
            <input
              type={field.includes('Date') ? 'date' : field.includes('password') ? 'password' : field === 'read' ? 'checkbox' : 'text'}
              value={createFormData[field] ?? ''}
              onChange={(e) => setCreateFormData({ ...createFormData, [field]: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
              placeholder={`Enter ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
            />
          </label>
        ))}
      </div>
    );
  };

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-green-700 mb-6">Dashboard</h1>

      {/* Entity Selector */}
      <div className="mb-6 flex gap-2 items-center">
        {(['users', 'invoices', 'payments', 'notifications'] as EntityType[]).map((entity) => (
          <button
            key={entity}
            onClick={() => setSelectedEntity(entity)}
            className={`px-4 py-2 rounded-md font-semibold transition ${
              selectedEntity === entity
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {entity.charAt(0).toUpperCase() + entity.slice(1)}
          </button>
        ))}
        <button
          onClick={handleCreate}
          className="ml-auto px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition"
        >
          + Create New
        </button>
      </div>

      {/* Loading/Error */}
      {loading && <p className="text-gray-600">Loading...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-green-100">
                {renderTableHeaders().map((h) => (
                  <th key={h} className="px-4 py-2 border text-left font-semibold text-green-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={renderTableHeaders().length} className="px-4 py-6 text-center text-gray-500">
                    No {selectedEntity} found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {renderTableRow(item)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View Modal */}
      {viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <h2 className="text-2xl font-bold text-green-700 mb-4">View Details</h2>
            
            {/* Main details */}
            <div className="bg-gray-100 p-4 rounded mb-6">
              <h3 className="font-semibold text-lg mb-2">Basic Information</h3>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(viewModal, null, 2)}
              </pre>
            </div>

            {/* User-specific sections */}
            {selectedEntity === 'users' && (
              <>
                {/* Contacts Section */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-lg text-green-700">Contacts ({userContacts.length})</h3>
                    <button
                      onClick={() => setShowAddContact(!showAddContact)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      + Add Contact
                    </button>
                  </div>

                  {/* Add contact form */}
                  {showAddContact && (
                    <div className="bg-gray-50 p-3 rounded mb-3 flex gap-2">
                      <input
                        type="number"
                        value={newContactId}
                        onChange={(e) => setNewContactId(e.target.value)}
                        placeholder="Enter User ID"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded"
                      />
                      <button
                        onClick={handleAddContact}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddContact(false);
                          setNewContactId('');
                        }}
                        className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Contacts list */}
                  {userContacts.length === 0 ? (
                    <p className="text-gray-500 text-sm">No contacts yet.</p>
                  ) : (
                    <div className="border border-gray-300 rounded overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-semibold">ID</th>
                            <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                            <th className="px-4 py-2 text-left text-sm font-semibold">Email</th>
                            <th className="px-4 py-2 text-left text-sm font-semibold">Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userContacts.map((contact) => (
                            <tr key={contact.id} className="border-t">
                              <td className="px-4 py-2 text-sm">{contact.id}</td>
                              <td className="px-4 py-2 text-sm">{contact.name} {contact.surnames}</td>
                              <td className="px-4 py-2 text-sm">{contact.email}</td>
                              <td className="px-4 py-2 text-sm">{contact.phone ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Notifications Section */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-lg text-green-700">
                      Notifications ({userNotifications.filter(n => !n.read).length} unread)
                    </h3>
                    {userNotifications.some(n => !n.read) && (
                      <button
                        onClick={handleMarkAllNotificationsRead}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Mark All as Read
                      </button>
                    )}
                  </div>

                  {userNotifications.length === 0 ? (
                    <p className="text-gray-500 text-sm">No notifications.</p>
                  ) : (
                    <div className="space-y-2">
                      {userNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 rounded border flex justify-between items-center ${
                            notif.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-300'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{notif.type}</span>
                              {!notif.read && (
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">Unread</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Invoice ID: {notif.invoiceId} • {new Date(notif.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!notif.read && (
                            <button
                              onClick={() => handleMarkNotificationRead(notif.id)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs ml-3"
                            >
                              Mark as Read
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              onClick={() => {
                setViewModal(null);
                setUserContacts([]);
                setUserNotifications([]);
                setShowAddContact(false);
                setNewContactId('');
              }}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-green-700 mb-4">Edit {selectedEntity.slice(0, -1)}</h2>
            {renderEditForm()}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleEditSubmit}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Confirm Delete</h2>
            <p className="mb-6">
              Are you sure you want to delete this {selectedEntity.slice(0, -1)}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-green-700 mb-4">Create New {selectedEntity.slice(0, -1)}</h2>
            {renderCreateForm()}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCreateSubmit}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setCreateModal(false);
                  setCreateFormData({});
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Dashboard;