import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleDocuments = [
  {
    id: 'getting-started',
    title: '👋 Welcome to Your Notion-like Editor!',
    content: [
      {
        type: 'h1',
        children: [{ text: '👋 Welcome to Your Notion-like Editor!' }],
      },
      {
        type: 'p',
        children: [
          { text: 'This is a powerful document editor built with ' },
          { text: 'Plate.js', bold: true },
          { text: ' that gives you Notion-like editing capabilities.' },
        ],
      },
      {
        type: 'h2',
        children: [{ text: '✨ Features' }],
      },
      {
        type: 'ul',
        children: [
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [
                  { text: 'Rich text formatting with ' },
                  { text: 'bold', bold: true },
                  { text: ', ' },
                  { text: 'italic', italic: true },
                  { text: ', and ' },
                  { text: 'underline', underline: true },
                ],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [
                  { text: 'Block types: headings, lists, quotes, code blocks' },
                ],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [
                  { text: 'AI-powered editing with ' },
                  { text: '⌘+J', kbd: true },
                ],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Slash commands for quick formatting' }],
              },
            ],
          },
        ],
      },
      {
        type: 'blockquote',
        children: [
          {
            type: 'p',
            children: [
              {
                text: '💡 Tip: Hover over any block to see additional options and use the floating toolbar for quick formatting.',
              },
            ],
          },
        ],
      },
    ],
    isStarred: true,
  },
  {
    id: 'product-requirements',
    title: '📋 Product Requirements Document',
    content: [
      {
        type: 'h1',
        children: [{ text: '📋 Product Requirements Document' }],
      },
      {
        type: 'p',
        children: [
          {
            text: 'This document outlines the requirements for building a comprehensive Notion-like document editor.',
          },
        ],
      },
      {
        type: 'h2',
        children: [{ text: 'Core Features' }],
      },
      {
        type: 'ul',
        children: [
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Rich text editing capabilities' }],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Database persistence with PostgreSQL' }],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Document management system' }],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Collaborative editing features' }],
              },
            ],
          },
        ],
      },
    ],
    isStarred: false,
  },
  {
    id: 'meeting-notes',
    title: '📝 Meeting Notes - Project Kickoff',
    content: [
      {
        type: 'h1',
        children: [{ text: '📝 Meeting Notes - Project Kickoff' }],
      },
      {
        type: 'p',
        children: [{ text: 'Date: January 17, 2024' }],
      },
      {
        type: 'p',
        children: [
          { text: 'Attendees: Development Team, Product Manager, Designer' },
        ],
      },
      {
        type: 'h2',
        children: [{ text: 'Key Decisions' }],
      },
      {
        type: 'ul',
        children: [
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [
                  { text: 'Use Plate.js as the primary editor framework' },
                ],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [
                  { text: 'Implement PostgreSQL database with Prisma ORM' },
                ],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Add real-time collaboration features' }],
              },
            ],
          },
        ],
      },
      {
        type: 'h2',
        children: [{ text: 'Next Steps' }],
      },
      {
        type: 'ol',
        children: [
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Set up database schema' }],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Implement API routes' }],
              },
            ],
          },
          {
            type: 'li',
            children: [
              {
                type: 'lic',
                children: [{ text: 'Update frontend to use database' }],
              },
            ],
          },
        ],
      },
    ],
    isStarred: false,
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const user = await prisma.user.upsert({
    where: { id: 'demo-user' },
    update: {},
    create: {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
    },
  });

  console.log('👤 Created demo user:', user.email);

  // Create sample documents
  for (const docData of sampleDocuments) {
    const document = await prisma.document.upsert({
      where: { id: docData.id },
      update: {
        title: docData.title,
        content: docData.content,
      },
      create: {
        id: docData.id,
        title: docData.title,
        content: docData.content,
        authorId: user.id,
      },
    });

    console.log('📄 Created document:', document.title);

    // Add to favorites if starred
    if (docData.isStarred) {
      await prisma.favorite.upsert({
        where: {
          userId_documentId: {
            userId: user.id,
            documentId: document.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          documentId: document.id,
        },
      });
      console.log('⭐ Added to favorites:', document.title);
    }
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
