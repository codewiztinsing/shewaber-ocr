'use client'

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, from, HttpLink } from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { ReactNode } from 'react'

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
  credentials: 'include',
  fetchOptions: {
    mode: 'cors',
  },
})

// Error link for debugging
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    })
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`)
    console.error(`[Network error details]:`, {
      name: networkError.name,
      message: networkError.message,
      statusCode: (networkError as any).statusCode,
      result: (networkError as any).result,
    })
  }
})

const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
})

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>
}

