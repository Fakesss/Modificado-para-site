import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function Salas() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubbles" size={28} color="#9B59B6" />
        <Text style={styles.title}>Salas de Estudo</Text>
      </View>
      <View style={styles.content}>
        <Ionicons name="construct-outline" size={64} color="#333" />
        <Text style={styles.text}>Em breve: Crie salas para jogar e estudar com seus amigos!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 20 },
  text: { color: '#666', fontSize: 16, textAlign: 'center' }
});
