import { PrismaClient } from '@prisma/client';

interface Context {
  prisma: PrismaClient;
  req?: any;
}

export const resolvers = {
  Query: {
    receipts: async (_: any, args: { filter?: any }, context: Context) => {
      const { filter } = args;
      const where: any = {};

      if (filter) {
        if (filter.storeName) {
          where.storeName = {
            contains: filter.storeName,
            mode: 'insensitive',
          };
        }

        if (filter.startDate || filter.endDate) {
          where.purchaseDate = {};
          if (filter.startDate) {
            where.purchaseDate.gte = new Date(filter.startDate);
          }
          if (filter.endDate) {
            where.purchaseDate.lte = new Date(filter.endDate);
          }
        }
      }

      return await context.prisma.receipt.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    },

    receipt: async (_: any, args: { id: string }, context: Context) => {
      return await context.prisma.receipt.findUnique({
        where: { id: args.id },
        include: {
          items: true,
        },
      });
    },

    jobStatus: async (_: any, args: { jobId: string }, context: Context) => {
      const { getJobStatus } = await import('../queue/ocr.queue');
      return await getJobStatus(args.jobId);
    },
  },

  Mutation: {
    uploadReceipt: async (_: any, args: { imageUrl: string }, context: Context) => {
      // This mutation is kept for GraphQL compatibility
      // But file upload is handled via REST endpoint /api/upload
      // This can be used if imageUrl is already known
      const receipt = await context.prisma.receipt.findFirst({
        where: { imageUrl: args.imageUrl },
        include: { items: true },
      });

      if (!receipt) {
        throw new Error('Receipt not found. Please use /api/upload endpoint to upload files.');
      }

      return receipt;
    },
  },
};

