import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ChatPage } from '@/features/chat/pages/ChatPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ChatPage />,
  },
  {
    path: '/chat/:conversationId',
    element: <ChatPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
