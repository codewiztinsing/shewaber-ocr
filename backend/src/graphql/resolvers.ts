import { PrismaClient } from '@prisma/client';

interface Context {
  prisma: PrismaClient;
  req?: any;
}

export const resolvers = {
  Receipt: {
    purchaseDate: (parent: any) => {
      if (!parent.purchaseDate) {
        return null;
      }
      // Ensure date is serialized as ISO string
      const date = parent.purchaseDate instanceof Date 
        ? parent.purchaseDate 
        : new Date(parent.purchaseDate);
      
      if (isNaN(date.getTime())) {
        console.log('[GraphQL] Invalid purchaseDate:', parent.purchaseDate);
        return null;
      }
      
      const isoString = date.toISOString();
      console.log('[GraphQL] Serializing purchaseDate:', parent.purchaseDate, '->', isoString);
      return isoString;
    },
  },
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
        orderBy: [
          {
            purchaseDate: 'desc', // Most recent purchase date first
          },
          {
            createdAt: 'desc', // Fallback to creation date if purchaseDate is null
          },
        ],
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

    updateReceipt: async (_: any, args: { id: string; input: any; items?: any[] }, context: Context) => {
      const { id, input, items } = args;

      // Validate receipt exists
      const existingReceipt = await context.prisma.receipt.findUnique({
        where: { id },
      });

      if (!existingReceipt) {
        throw new Error('Receipt not found');
      }

      // Prepare update data
      const updateData: any = {};

      if (input.storeName !== undefined) {
        updateData.storeName = input.storeName;
      }

      if (input.purchaseDate !== undefined) {
        // Validate date
        const date = input.purchaseDate ? new Date(input.purchaseDate) : null;
        updateData.purchaseDate = date && !isNaN(date.getTime()) ? date : null;
      }

      if (input.totalAmount !== undefined) {
        updateData.totalAmount = input.totalAmount;
      }

      // Update receipt
      const receipt = await context.prisma.receipt.update({
        where: { id },
        data: {
          ...updateData,
          ...(items && {
            items: {
              deleteMany: {}, // Delete all existing items
              create: items.map((item) => ({
                name: item.name,
                quantity: item.quantity || null,
                price: item.price || null,
              })),
            },
          }),
        },
        include: {
          items: true,
        },
      });

      return receipt;
    },

    deleteReceipt: async (_: any, args: { id: string }, context: Context) => {
      // Check if receipt exists
      const receipt = await context.prisma.receipt.findUnique({
        where: { id: args.id },
        include: { items: true },
      });

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      // Delete receipt (items will be deleted automatically due to onDelete: Cascade)
      await context.prisma.receipt.delete({
        where: { id: args.id },
      });

      // Optionally delete the image file
      if (receipt.imageUrl) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
          const imagePath = path.join(uploadDir, receipt.imageUrl.replace('/uploads/', ''));
          
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (error) {
          console.error('Error deleting image file:', error);
          // Don't fail the deletion if file deletion fails
        }
      }

      return true;
    },

    deleteItem: async (_: any, args: { id: string }, context: Context) => {
      // Check if item exists
      const item = await context.prisma.item.findUnique({
        where: { id: args.id },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // Delete item
      await context.prisma.item.delete({
        where: { id: args.id },
      });

      return true;
    },
  },
};

