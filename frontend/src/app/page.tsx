'use client'

import { useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'

// API URL - will be replaced at build time with NEXT_PUBLIC_API_URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const GET_RECEIPTS = gql`
  query GetReceipts($filter: ReceiptFilter) {
    receipts(filter: $filter) {
      id
      storeName
      purchaseDate
      totalAmount
      imageUrl
      items {
        id
        name
        quantity
        price
      }
      createdAt
      updatedAt
    }
  }
`

const GET_RECEIPT = gql`
  query GetReceipt($id: ID!) {
    receipt(id: $id) {
      id
      storeName
      purchaseDate
      totalAmount
      imageUrl
      items {
        id
        name
        quantity
        price
      }
      createdAt
      updatedAt
    }
  }
`

const UPDATE_RECEIPT = gql`
  mutation UpdateReceipt($id: ID!, $input: UpdateReceiptInput!, $items: [UpdateItemInput!]) {
    updateReceipt(id: $id, input: $input, items: $items) {
      id
      storeName
      purchaseDate
      totalAmount
      items {
        id
        name
        quantity
        price
      }
    }
  }
`

const DELETE_RECEIPT = gql`
  mutation DeleteReceipt($id: ID!) {
    deleteReceipt(id: $id)
  }
`

const DELETE_ITEM = gql`
  mutation DeleteItem($id: ID!) {
    deleteItem(id: $id)
  }
`

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [storeFilter, setStoreFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const [editingReceipt, setEditingReceipt] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [activeView, setActiveView] = useState<'all' | 'verified'>('all')

  const { data, loading, error, refetch } = useQuery(GET_RECEIPTS, {
    variables: {
      filter: {
        ...(storeFilter && { storeName: storeFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      },
    },
  })

  const [updateReceipt] = useMutation(UPDATE_RECEIPT, {
    refetchQueries: [{ query: GET_RECEIPTS }],
  })

  const [deleteReceipt] = useMutation(DELETE_RECEIPT, {
    refetchQueries: [{ query: GET_RECEIPTS }],
  })

  const [deleteItem] = useMutation(DELETE_ITEM, {
    refetchQueries: [{ query: GET_RECEIPTS }],
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.')
        return
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit.')
        return
      }

      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first.')
      return
    }

    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const receipt = await response.json()
      setSelectedFile(null)
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      // Refetch receipts
      refetch()
    } catch (err: any) {
      console.error('Upload error:', err)
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleFilter = () => {
    refetch({
      filter: {
        ...(storeFilter && { storeName: storeFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      },
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  const handleViewDetails = (receipt: any) => {
    setSelectedReceipt(receipt)
  }

  const handleEdit = (receipt: any) => {
    setEditingReceipt(receipt)
    setEditForm({
      storeName: receipt.storeName || '',
      purchaseDate: receipt.purchaseDate ? new Date(receipt.purchaseDate).toISOString().split('T')[0] : '',
      totalAmount: receipt.totalAmount || '',
      items: (receipt.items || []).map((item: any) => ({
        id: item.id,
        name: item.name || '',
        quantity: item.quantity || '',
        price: item.price || '',
      })),
    })
  }

  const handleUpdate = async () => {
    try {
      // Ensure items array exists and filter out empty items
      const items = (editForm.items || []).map((item: any) => ({
        id: item.id || null,
        name: item.name || '',
        quantity: item.quantity ? parseInt(item.quantity) : null,
        price: item.price ? parseFloat(item.price) : null,
      })).filter((item: any) => item.name && item.name.trim() !== '')

      await updateReceipt({
        variables: {
          id: editingReceipt.id,
          input: {
            storeName: editForm.storeName || null,
            purchaseDate: editForm.purchaseDate || null,
            totalAmount: editForm.totalAmount ? parseFloat(editForm.totalAmount) : null,
          },
          items: items.length > 0 ? items : [],
        },
      })

      setEditingReceipt(null)
      setEditForm({})
      alert('Receipt updated successfully!')
    } catch (err: any) {
      alert(`Error updating receipt: ${err.message}`)
    }
  }

  const handleDelete = async (receiptId: string) => {
    if (!confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      return
    }

    try {
      await deleteReceipt({
        variables: { id: receiptId },
      })
      alert('Receipt deleted successfully!')
    } catch (err: any) {
      alert(`Error deleting receipt: ${err.message}`)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }

    try {
      await deleteItem({
        variables: { id: itemId },
      })
      if (editingReceipt) {
        // Refresh the edit form
        refetch()
      }
    } catch (err: any) {
      alert(`Error deleting item: ${err.message}`)
    }
  }

  const addItemToEdit = () => {
    setEditForm({
      ...editForm,
      items: [...editForm.items, { id: null, name: '', quantity: '', price: '' }],
    })
  }

  const removeItemFromEdit = (index: number) => {
    const items = [...editForm.items]
    items.splice(index, 1)
    setEditForm({ ...editForm, items })
  }

  const updateItemInEdit = (index: number, field: string, value: any) => {
    const items = [...editForm.items]
    items[index] = { ...items[index], [field]: value }
    setEditForm({ ...editForm, items })
  }

  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span>🤖</span>
            <span>Receipt OCR</span>
          </div>
          <ul className="nav-menu">
            <li><a onClick={() => setActiveView('all')}>All Receipts</a></li>
            <li><a onClick={() => setActiveView('verified')}>Verified</a></li>
            <li><a onClick={() => setSidebarOpen(!sidebarOpen)}>Filters</a></li>
          </ul>
        </div>
        <div className="header-right">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="button button-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          >
            {sidebarOpen ? '← Hide' : '→ Show'} Sidebar
          </button>
        </div>
      </header>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        {/* Sidebar */}
        <div className={`sidebar ${!sidebarOpen ? 'hidden' : ''}`}>
        {/* Sidebar Header */}
        <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>Data Extraction</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Upload & Manage Receipts</p>
        </div>

        {/* Upload Section */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Upload Receipt</h3>
        <input
          id="file-input"
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="input"
        />
        {selectedFile && (
          <div>
            <p>Selected: {selectedFile.name}</p>
            <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="button"
            style={{ width: '100%' }}
          >
            {uploading ? 'Processing...' : 'Upload & Extract'}
          </button>
          {uploadError && (
            <div className="error" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Error: {uploadError}
            </div>
          )}
        </div>

        {/* Filter Section */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Filter Receipts</h3>
        <input
          type="text"
          placeholder="Store name"
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="input"
        />
        <input
          type="date"
          placeholder="Start date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="input"
        />
        <input
          type="date"
          placeholder="End date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="input"
        />
          <button onClick={handleFilter} className="button" style={{ width: '100%' }}>
            Apply Filters
          </button>
          <button
            onClick={() => {
              setStoreFilter('')
              setStartDate('')
              setEndDate('')
              refetch({ filter: {} })
            }}
            className="button"
            style={{ width: '100%', marginTop: '0.5rem', background: '#6c757d' }}
          >
            Clear Filters
          </button>
        </div>

        {/* Stats Section */}
        {data && data.receipts && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Statistics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{data.receipts.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Verified:</span>
                <strong style={{ color: 'var(--primary-color)' }}>
                  {data.receipts.filter((r: any) => r.totalAmount && r.items && r.items.length > 0).length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Amount:</span>
                <strong style={{ color: 'var(--primary-color)' }}>
                  ${data.receipts.reduce((sum: number, r: any) => sum + (r.totalAmount || 0), 0).toFixed(2)}
                </strong>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Main Content */}
        <div className={`main-content ${!sidebarOpen ? 'full-width' : ''}`}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {activeView === 'verified' ? 'Verified Receipts' : 'Receipt Validator'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              {activeView === 'verified' 
                ? 'View and manage verified receipts with complete extracted data.'
                : 'Upload an image of your receipt to verify its authenticity and extract data using advanced OCR technology.'}
            </p>
            {data && data.receipts && (
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                Showing {activeView === 'verified' 
                  ? data.receipts.filter((r: any) => r.totalAmount && r.items && r.items.length > 0).length
                  : data.receipts.length} receipt{activeView === 'verified' 
                    ? data.receipts.filter((r: any) => r.totalAmount && r.items && r.items.length > 0).length !== 1 ? 's' : ''
                    : data.receipts.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

        {/* Results Section */}
        <div>
        {loading && <div className="loading">Loading...</div>}
        {error && (
          <div className="error">
            Error loading receipts: {error.message}
          </div>
        )}
        {data && data.receipts && data.receipts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '1.2rem', color: '#666' }}>No receipts found.</p>
            <p style={{ color: '#999' }}>Upload a receipt to get started.</p>
          </div>
        )}
        {data && data.receipts && data.receipts.length > 0 && (() => {
          // Filter receipts based on active view
          const filteredReceipts = activeView === 'verified' 
            ? data.receipts.filter((r: any) => r.totalAmount && r.items && r.items.length > 0)
            : data.receipts;
          
          if (filteredReceipts.length === 0) {
            return (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '1.2rem', color: '#666' }}>
                  {activeView === 'verified' ? 'No verified receipts found.' : 'No receipts found.'}
                </p>
                <p style={{ color: '#999' }}>
                  {activeView === 'verified' ? 'Verified receipts have completed OCR processing with extracted data.' : 'Upload a receipt to get started.'}
                </p>
              </div>
            );
          }
          
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {filteredReceipts.map((receipt: any) => (
              <div key={receipt.id} className="card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3>{receipt.storeName || 'Unknown Store'}</h3>
                    <p><strong>Date:</strong> {formatDate(receipt.purchaseDate)}</p>
                    <p><strong>Total Amount:</strong> ${receipt.totalAmount?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleViewDetails(receipt)}
                      className="button"
                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEdit(receipt)}
                      className="button"
                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#28a745' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className="button"
                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#dc3545' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {receipt.imageUrl && (
                  <div>
                    <img
                      src={`${API_URL}${receipt.imageUrl}`}
                      alt="Receipt"
                      style={{ maxWidth: '100%', marginTop: '1rem', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => handleViewDetails(receipt)}
                      onError={(e) => {
                        console.error('Failed to load image:', receipt.imageUrl);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div style={{ marginTop: '1rem' }}>
                  <h4>Items ({receipt.items?.length || 0}):</h4>
                  {receipt.items && receipt.items.length > 0 ? (
                    <ul>
                      {receipt.items.slice(0, 3).map((item: any) => (
                        <li key={item.id}>
                          {item.name}
                          {item.quantity && ` (Qty: ${item.quantity})`}
                          {item.price && ` - $${item.price.toFixed(2)}`}
                        </li>
                      ))}
                      {receipt.items.length > 3 && (
                        <li style={{ fontStyle: 'italic', color: '#666' }}>
                          ... and {receipt.items.length - 3} more items
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p>No items extracted</p>
                  )}
                </div>
              </div>
              ))}
            </div>
          );
        })(        )}
        </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReceipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
        }} onClick={() => setSelectedReceipt(null)}>
          <div className="card" style={{
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedReceipt(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
            >
              ×
            </button>
            <h2>Receipt Details</h2>
            <div style={{ marginTop: '1rem' }}>
              <p><strong>ID:</strong> {selectedReceipt.id}</p>
              <p><strong>Store Name:</strong> {selectedReceipt.storeName || 'N/A'}</p>
              <p><strong>Purchase Date:</strong> {formatDateTime(selectedReceipt.purchaseDate)}</p>
              <p><strong>Total Amount:</strong> ${selectedReceipt.totalAmount?.toFixed(2) || 'N/A'}</p>
              <p><strong>Created:</strong> {formatDateTime(selectedReceipt.createdAt)}</p>
              {selectedReceipt.updatedAt && (
                <p><strong>Last Updated:</strong> {formatDateTime(selectedReceipt.updatedAt)}</p>
              )}
            </div>
            {selectedReceipt.imageUrl && (
              <div style={{ marginTop: '1rem' }}>
                <img
                  src={`${API_URL}${selectedReceipt.imageUrl}`}
                  alt="Receipt"
                  style={{ maxWidth: '100%', borderRadius: '4px' }}
                />
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <h3>Items ({selectedReceipt.items?.length || 0}):</h3>
              {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Quantity</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Price</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.items.map((item: any) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{item.name}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem' }}>{item.quantity || '-'}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                          {item.price ? `$${item.price.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                          {item.quantity && item.price ? `$${(item.quantity * item.price).toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No items extracted</p>
              )}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setSelectedReceipt(null)
                  handleEdit(selectedReceipt)
                }}
                className="button"
                style={{ background: '#28a745' }}
              >
                Edit Receipt
              </button>
              <button
                onClick={() => {
                  setSelectedReceipt(null)
                  handleDelete(selectedReceipt.id)
                }}
                className="button"
                style={{ background: '#dc3545' }}
              >
                Delete Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingReceipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
        }} onClick={() => {
          setEditingReceipt(null)
          setEditForm({})
        }}>
          <div className="card" style={{
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setEditingReceipt(null)
                setEditForm({})
              }}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
            >
              ×
            </button>
            <h2>Edit Receipt</h2>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Store Name:</label>
              <input
                type="text"
                value={editForm.storeName || ''}
                onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                className="input"
                placeholder="Store name"
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Purchase Date:</label>
              <input
                type="date"
                value={editForm.purchaseDate || ''}
                onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                className="input"
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Total Amount:</label>
              <input
                type="number"
                step="0.01"
                value={editForm.totalAmount || ''}
                onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label>Items:</label>
                <button
                  onClick={addItemToEdit}
                  className="button"
                  style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}
                >
                  + Add Item
                </button>
              </div>
              {editForm.items && editForm.items.map((item: any, index: number) => (
                <div key={index} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  alignItems: 'center',
                }}>
                  <input
                    type="text"
                    value={item.name || ''}
                    onChange={(e) => updateItemInEdit(index, 'name', e.target.value)}
                    className="input"
                    placeholder="Item name"
                  />
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => updateItemInEdit(index, 'quantity', e.target.value)}
                    className="input"
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={item.price || ''}
                    onChange={(e) => updateItemInEdit(index, 'price', e.target.value)}
                    className="input"
                    placeholder="Price"
                  />
                  <button
                    onClick={() => {
                      if (item.id) {
                        handleDeleteItem(item.id)
                      } else {
                        removeItemFromEdit(index)
                      }
                    }}
                    className="button"
                    style={{ background: '#dc3545', padding: '0.4rem 0.8rem' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleUpdate}
                className="button"
                style={{ background: '#28a745', flex: 1 }}
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditingReceipt(null)
                  setEditForm({})
                }}
                className="button"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

