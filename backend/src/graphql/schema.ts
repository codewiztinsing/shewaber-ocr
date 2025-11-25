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

  type Query {
    receipts(filter: ReceiptFilter): [Receipt!]!
    receipt(id: ID!): Receipt
  }

  type Mutation {
    uploadReceipt(imageUrl: String!): Receipt!
  }
`;

