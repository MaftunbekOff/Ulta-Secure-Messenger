# UltraSecure Messenger

## Overview

UltraSecure Messenger is a real-time chat application built with a modern web stack. The application features end-to-end encrypted messaging, user authentication, and real-time communication through WebSockets. It supports both direct messaging and group chats with a clean, responsive interface built using React and shadcn/ui components.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern component patterns
- **UI Library**: shadcn/ui components built on top of Radix UI primitives for accessibility and customization
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form validation
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for REST API endpoints
- **WebSocket**: Native WebSocket implementation for real-time messaging and typing indicators
- **Authentication**: JWT (JSON Web Tokens) with bcrypt for password hashing
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful endpoints for user management, chat operations, and message handling

### Database Design
- **Database**: PostgreSQL with Neon serverless for scalability
- **Schema**: Well-structured relational design with the following key entities:
  - Users: Authentication and profile information
  - Chats: Support for both direct messages and group chats
  - Messages: Encrypted message content with metadata
  - Chat Members: Many-to-many relationship for chat participation
  - Message Reads: Read receipt tracking
- **Migrations**: Drizzle-kit for database schema management and migrations

### Advanced Security Features
- **Message Encryption**: Client-side encryption for message content (MVP implementation with XOR cipher)
- **Authentication**: JWT-based authentication with secure token storage
- **Password Security**: bcrypt hashing for password storage
- **Multi-Step Password Reset**: Comprehensive password reset system with:
  - Email verification step
  - Account verification (username + birth date validation)
  - Security questions verification
  - Multi-layered protection against unauthorized access
- **Security Settings Management**: User-configurable security options including:
  - Username requirement for password reset
  - Security questions enforcement
  - Last activity verification
  - Toggleable security features
- **Security Questions System**: Predefined security questions with encrypted answers for additional account protection
- **Session Management**: Secure session handling with HTTP-only considerations

### Real-time Communication
- **WebSocket Integration**: Custom WebSocket server for live messaging, typing indicators, and user presence
- **Connection Management**: Active connection tracking with automatic reconnection logic
- **Message Broadcasting**: Efficient message distribution to chat participants

### Development Tools
- **TypeScript**: Full-stack type safety with shared types between client and server
- **ESM**: Modern ES modules throughout the application
- **Development Environment**: Hot module replacement with Vite and Express middleware integration
- **Code Quality**: Consistent code formatting and type checking

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Drizzle ORM**: Type-safe database operations and schema management

### UI and Styling
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Icon library for consistent iconography

### Authentication and Security
- **bcryptjs**: Password hashing for secure authentication
- **jsonwebtoken**: JWT implementation for stateless authentication
- **Zod**: Runtime type validation for API inputs and forms

### Real-time Communication
- **ws**: WebSocket library for real-time messaging capabilities
- **TanStack Query**: Advanced server state management with caching and synchronization

### Development and Build Tools
- **Vite**: Fast build tool with hot module replacement
- **TypeScript**: Static type checking and enhanced developer experience
- **React Hook Form**: Performant form handling with minimal re-renders
- **Wouter**: Lightweight routing solution for single-page application navigation