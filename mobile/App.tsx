import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: string;
  encrypted: boolean;
}

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  unreadCount: number;
}

const UltraSecureMessenger: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // WebSocket connection for real-time messaging
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        // Use your Replit WebSocket URL
        const wsUrl = 'wss://your-repl-name.your-username.repl.co/ws';
        const websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          console.log('✅ Mobile WebSocket connected');
          setIsConnected(true);
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
              const newMsg: Message = {
                id: data.messageId || Date.now().toString(),
                content: data.content,
                senderId: data.senderId,
                timestamp: data.timestamp,
                encrypted: true,
              };
              setMessages(prev => [...prev, newMsg]);
            }
          } catch (error) {
            console.error('Message parsing error:', error);
          }
        };

        websocket.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };

        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        setWs(websocket);
      } catch (error) {
        console.error('WebSocket connection failed:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Military-grade encryption simulation
  const encryptMessage = (message: string): string => {
    // Simplified encryption for demo - use real RSA-4096 in production
    return btoa(message + '_ULTRA_ENCRYPTED_' + Date.now());
  };

  const decryptMessage = (encryptedMessage: string): string => {
    try {
      const decoded = atob(encryptedMessage);
      return decoded.split('_ULTRA_ENCRYPTED_')[0];
    } catch {
      return encryptedMessage;
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat || !ws) return;

    const encryptedContent = encryptMessage(newMessage);

    const message = {
      type: 'message',
      chatId: activeChat,
      content: encryptedContent,
      senderId: currentUser,
      messageId: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));

      // Add to local messages immediately
      const localMessage: Message = {
        id: message.messageId,
        content: newMessage, // Store decrypted locally
        senderId: currentUser,
        timestamp: message.timestamp,
        encrypted: true,
      };

      setMessages(prev => [...prev, localMessage]);
      setNewMessage('');
    } else {
      Alert.alert('Connection Error', 'WebSocket not connected');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === currentUser;
    return (
      <View style={[styles.messageContainer, isOwn ? styles.ownMessage : styles.otherMessage]}>
        <Text style={styles.messageContent}>
          {item.encrypted ? decryptMessage(item.content) : item.content}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString()}
          {item.encrypted && ' 🔒'}
        </Text>
      </View>
    );
  };

  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={[styles.chatItem, activeChat === item.id && styles.activeChatItem]}
      onPress={() => setActiveChat(item.id)}
    >
      <Text style={styles.chatName}>{item.name}</Text>
      <Text style={styles.lastMessage}>{item.lastMessage}</Text>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚀 UltraSecure Messenger</Text>
        <View style={[styles.connectionStatus, isConnected ? styles.connected : styles.disconnected]}>
          <Text style={styles.statusText}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </Text>
        </View>
      </View>

      <View style={styles.mainContent}>
        {/* Chat List */}
        <View style={styles.chatListContainer}>
          <Text style={styles.sectionTitle}>Chats</Text>
          <FlatList
            data={chats}
            renderItem={renderChat}
            keyExtractor={(item) => item.id}
            style={styles.chatList}
          />
        </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          <FlatList
            data={messages.filter(msg => msg.senderId === activeChat || msg.senderId === currentUser)}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
          />

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type ultra-secure message..."
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  connectionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connected: {
    backgroundColor: '#004d00',
  },
  disconnected: {
    backgroundColor: '#4d0000',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  chatListContainer: {
    width: '30%',
    backgroundColor: '#111',
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  activeChatItem: {
    backgroundColor: '#333',
  },
  chatName: {
    color: '#fff',
    fontWeight: 'bold',
  },
  lastMessage: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  unreadBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007bff',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#333',
  },
  messageContent: {
    color: '#fff',
    fontSize: 16,
  },
  timestamp: {
    color: '#ccc',
    fontSize: 10,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    backgroundColor: '#222',
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#007bff',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 20,
  },
});

export default UltraSecureMessenger;