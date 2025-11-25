'use client'

import { useState } from 'react'
import { useQuery, gql } from '@apollo/client'

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

  return (
    <div className="container">
      <h1>Receipt OCR & Data Extraction</h1>

      {/* Upload Section */}
      <div className="card">
        <h2>Upload Receipt</h2>
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
        >
          {uploading ? 'Processing...' : 'Upload & Extract'}
        </button>
        {uploadError && (
          <div className="error">
            Error: {uploadError}
          </div>
        )}
      </div>

      {/* Filter Section */}
      <div className="card">
        <h2>Filter Receipts</h2>
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
        <button onClick={handleFilter} className="button">
          Apply Filters
        </button>
      </div>

      {/* Results Section */}
      <div className="card">
        <h2>Extracted Receipts</h2>
        {loading && <div className="loading">Loading...</div>}
        {error && (
          <div className="error">
            Error loading receipts: {error.message}
          </div>
        )}
        {data && data.receipts && data.receipts.length === 0 && (
          <p>No receipts found. Upload a receipt to get started.</p>
        )}
        {data && data.receipts && data.receipts.length > 0 && (
          <div>
            {data.receipts.map((receipt: any) => (
              <div key={receipt.id} className="card" style={{ marginTop: '1rem' }}>
                <h3>{receipt.storeName || 'Unknown Store'}</h3>
                <p><strong>Date:</strong> {formatDate(receipt.purchaseDate)}</p>
                <p><strong>Total Amount:</strong> ${receipt.totalAmount?.toFixed(2) || 'N/A'}</p>
                {receipt.imageUrl && (
                  <div>
                    <img
                      src={`${API_URL}${receipt.imageUrl}`}
                      alt="Receipt"
                      style={{ maxWidth: '100%', marginTop: '1rem', borderRadius: '4px' }}
                      onError={(e) => {
                        console.error('Failed to load image:', receipt.imageUrl);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div style={{ marginTop: '1rem' }}>
                  <h4>Items:</h4>
                  {receipt.items && receipt.items.length > 0 ? (
                    <ul>
                      {receipt.items.map((item: any) => (
                        <li key={item.id}>
                          {item.name}
                          {item.quantity && ` (Qty: ${item.quantity})`}
                          {item.price && ` - $${item.price.toFixed(2)}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No items extracted</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

