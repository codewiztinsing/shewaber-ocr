# Receipt OCR - Features Documentation

## ✅ Implemented Features

### 1. Receipt Upload & OCR Processing
- ✅ Upload receipt images (JPEG, PNG, GIF, WebP)
- ✅ Background processing with BullMQ queues
- ✅ Real-time job status tracking
- ✅ Automatic data extraction (store name, date, total, items)

### 2. Receipt Management

#### View Receipts
- ✅ List all receipts with filtering
- ✅ Filter by store name
- ✅ Filter by date range
- ✅ Display receipt summary (store, date, total, items count)

#### View Receipt Details
- ✅ Full receipt details modal
- ✅ Complete item list with quantities and prices
- ✅ Receipt image display
- ✅ Created/updated timestamps
- ✅ Item totals calculation

#### Edit Receipt
- ✅ Edit store name
- ✅ Edit purchase date
- ✅ Edit total amount
- ✅ Edit items (add, remove, modify)
- ✅ Inline item editing
- ✅ Save changes

#### Delete Receipt
- ✅ Delete receipt with confirmation
- ✅ Automatic deletion of associated items
- ✅ Optional image file cleanup
- ✅ Safe deletion with error handling

### 3. Item Management
- ✅ View items in receipt
- ✅ Delete individual items
- ✅ Add new items
- ✅ Edit item details (name, quantity, price)

## API Endpoints

### GraphQL

**Queries:**
```graphql
# Get all receipts
query {
  receipts(filter: { storeName: "Walmart", startDate: "2024-01-01" }) {
    id
    storeName
    purchaseDate
    totalAmount
    items { id name quantity price }
  }
}

# Get single receipt
query {
  receipt(id: "receipt-id") {
    id
    storeName
    purchaseDate
    totalAmount
    items { id name quantity price }
    createdAt
    updatedAt
  }
}

# Check job status
query {
  jobStatus(jobId: "job-id") {
    id
    state
    progress
    result { receiptId storeName totalAmount }
  }
}
```

**Mutations:**
```graphql
# Update receipt
mutation {
  updateReceipt(
    id: "receipt-id"
    input: {
      storeName: "New Store Name"
      purchaseDate: "2024-01-15"
      totalAmount: 99.99
    }
    items: [
      { id: "item-id", name: "Item 1", quantity: 2, price: 10.50 }
      { name: "New Item", quantity: 1, price: 5.00 }
    ]
  ) {
    id
    storeName
    totalAmount
    items { id name quantity price }
  }
}

# Delete receipt
mutation {
  deleteReceipt(id: "receipt-id")
}

# Delete item
mutation {
  deleteItem(id: "item-id")
}
```

### REST API

**GET `/api/receipt/:id`**
- Get receipt details
- Returns: Receipt object with items

**PUT `/api/receipt/:id`**
- Update receipt
- Body: `{ storeName, purchaseDate, totalAmount, items: [...] }`
- Returns: Updated receipt

**DELETE `/api/receipt/:id`**
- Delete receipt
- Returns: `{ success: true, message: "..." }`

**POST `/api/upload`**
- Upload receipt image
- Returns: `{ jobId, receiptId, status, receipt }`

**GET `/api/job/:jobId`**
- Get job status
- Returns: Job status object

## Frontend Features

### Receipt List View
- ✅ Card-based layout
- ✅ Quick actions (View, Edit, Delete)
- ✅ Image preview
- ✅ Item count display
- ✅ Summary information

### Detail Modal
- ✅ Full-screen modal overlay
- ✅ Complete receipt information
- ✅ Item table with totals
- ✅ Receipt image
- ✅ Timestamps
- ✅ Quick actions (Edit, Delete)

### Edit Modal
- ✅ Inline form editing
- ✅ Store name input
- ✅ Date picker
- ✅ Amount input
- ✅ Dynamic item list
- ✅ Add/remove items
- ✅ Save/Cancel actions

## Usage Examples

### Update Receipt via GraphQL

```javascript
const UPDATE_RECEIPT = gql`
  mutation UpdateReceipt($id: ID!, $input: UpdateReceiptInput!, $items: [UpdateItemInput!]) {
    updateReceipt(id: $id, input: $input, items: $items) {
      id
      storeName
      totalAmount
      items { id name quantity price }
    }
  }
`;

// Usage
await updateReceipt({
  variables: {
    id: 'receipt-id',
    input: {
      storeName: 'Updated Store',
      purchaseDate: '2024-01-15',
      totalAmount: 150.00,
    },
    items: [
      { id: 'item-1', name: 'Item 1', quantity: 2, price: 10.50 },
      { name: 'New Item', quantity: 1, price: 5.00 },
    ],
  },
});
```

### Delete Receipt via REST

```bash
curl -X DELETE http://localhost:4000/api/receipt/receipt-id
```

### Update Receipt via REST

```bash
curl -X PUT http://localhost:4000/api/receipt/receipt-id \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Updated Store",
    "purchaseDate": "2024-01-15",
    "totalAmount": 150.00,
    "items": [
      {"name": "Item 1", "quantity": 2, "price": 10.50},
      {"name": "New Item", "quantity": 1, "price": 5.00}
    ]
  }'
```

## UI Components

### Receipt Card
- Store name (or "Unknown Store")
- Purchase date
- Total amount
- Item count preview
- Image thumbnail
- Action buttons (View, Edit, Delete)

### Detail Modal
- Full receipt information
- Item table with calculations
- Receipt image
- Metadata (created/updated dates)
- Action buttons

### Edit Modal
- Form inputs for all fields
- Dynamic item list
- Add/remove item buttons
- Save/Cancel actions

## Data Validation

### Receipt Updates
- ✅ Store name: Optional string
- ✅ Purchase date: Valid date or null
- ✅ Total amount: Valid number or null
- ✅ Items: Array of item objects

### Item Updates
- ✅ Name: Required string
- ✅ Quantity: Optional integer
- ✅ Price: Optional float

## Error Handling

- ✅ Receipt not found errors
- ✅ Invalid date validation
- ✅ Confirmation dialogs for destructive actions
- ✅ User-friendly error messages
- ✅ Automatic cleanup on errors

## Security Considerations

- ✅ Input validation
- ✅ Date validation
- ✅ Number validation
- ✅ Confirmation for deletions
- ✅ Error messages don't expose sensitive data

## Future Enhancements

Potential additions:
- Receipt categories/tags
- Export to CSV/PDF
- Receipt search
- Bulk operations
- Receipt sharing
- Receipt templates
- Receipt analytics

