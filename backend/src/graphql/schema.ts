import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Receipt {
    id: ID!
    storeName: String
    purchaseDate: String
    totalAmount: Float
    imageUrl: String
    items: [Item!]!
    createdAt: String!
    updatedAt: String!
  }

  type Item {
    id: ID!
    name: String!
    quantity: Int
    price: Float
    receiptId: String!
    createdAt: String!
  }

  input ReceiptFilter {
    storeName: String
    startDate: String
    endDate: String
  }

  input UpdateReceiptInput {
    storeName: String
    purchaseDate: String
    totalAmount: Float
  }

  input UpdateItemInput {
    id: String
    name: String
    quantity: Int
    price: Float
  }

  type JobStatus {
    id: String!
    state: String!
    progress: Int
    result: OCRJobResult
    failedReason: String
    timestamp: Float
  }

  type OCRJobResult {
    receiptId: String!
    storeName: String
    purchaseDate: String
    totalAmount: Float
    items: [ItemResult!]!
  }

  type ItemResult {
    name: String!
    quantity: Int
    price: Float
  }

  type UploadResponse {
    jobId: String!
    message: String!
    status: String!
  }

  type Query {
    receipts(filter: ReceiptFilter): [Receipt!]!
    receipt(id: ID!): Receipt
    jobStatus(jobId: String!): JobStatus
  }

  type Mutation {
    uploadReceipt(imageUrl: String!): Receipt!
    updateReceipt(id: ID!, input: UpdateReceiptInput!, items: [UpdateItemInput!]): Receipt!
    deleteReceipt(id: ID!): Boolean!
    deleteItem(id: ID!): Boolean!
  }
`;

