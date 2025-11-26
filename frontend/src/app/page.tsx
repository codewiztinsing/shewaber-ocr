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



export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [storeFilter, setStoreFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
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


  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo">
            <span>🤖</span>
            <span>Receipt OCR</span>
          </div>
          <ul className="nav-menu">
            <li><a onClick={() => setActiveView('all')}>All Receipts</a></li>
            <li><a onClick={() => setActiveView('verified')}>Verified</a></li>
          </ul>
        </div>
        <div className="header-right">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Data Extraction System</span>
        </div>
      </header>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        {/* Sidebar */}
        <div className="sidebar">
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
        <div className="main-content">
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
            <div className="receipts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {filteredReceipts.map((receipt: any) => (
              <div key={receipt.id} className="card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1.2rem' }}>{receipt.storeName || 'Unknown Store'}</h3>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Date:</strong> {formatDate(receipt.purchaseDate)}</p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Total Amount:</strong> ETB {receipt.totalAmount?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div className="receipt-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleViewDetails(receipt)}
                      className="button"
                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', width: '100%' }}
                    >
                      View Details
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
            <h2 style={{ marginBottom: '2rem', fontSize: '1.8rem', color: 'var(--text-primary)' }}>Receipt Details</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Store Name */}
              <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Store Name</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedReceipt.storeName || 'N/A'}
                </div>
              </div>

              {/* Date of Purchase */}
              <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date of Purchase</div>
                <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {formatDate(selectedReceipt.purchaseDate)}
                </div>
              </div>

              {/* Total Amount Spent */}
              <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount Spent</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary-color)' }}>
                  {selectedReceipt.totalAmount ? `ETB ${selectedReceipt.totalAmount.toFixed(2)}` : 'N/A'}
                </div>
              </div>

              {/* List of Purchased Items */}
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>List of Purchased Items</div>
                {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                  <div style={{ 
                    backgroundColor: 'var(--card-bg)', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ 
                          backgroundColor: 'var(--border-color)',
                          borderBottom: '2px solid var(--border-color)'
                        }}>
                          <th style={{ 
                            textAlign: 'left', 
                            padding: '0.75rem 1rem', 
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Item Name
                          </th>
                          <th style={{ 
                            textAlign: 'center', 
                            padding: '0.75rem 1rem', 
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            width: '100px'
                          }}>
                            Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceipt.items.map((item: any, index: number) => (
                          <tr 
                            key={item.id || index}
                            style={{
                              borderBottom: index < selectedReceipt.items.length - 1 ? '1px solid var(--border-color)' : 'none'
                            }}
                          >
                            <td style={{ 
                              padding: '0.75rem 1rem', 
                              fontSize: '0.95rem',
                              color: 'var(--text-primary)',
                              fontWeight: '500'
                            }}>
                              {item.name}
                            </td>
                            <td style={{ 
                              textAlign: 'center', 
                              padding: '0.75rem 1rem',
                              fontSize: '0.95rem',
                              color: 'var(--text-primary)',
                              fontWeight: '500'
                            }}>
                              {item.quantity || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    No items extracted
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

