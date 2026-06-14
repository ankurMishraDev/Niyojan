import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';

interface DropdownItem {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  items: DropdownItem[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export default function CustomDropdown({
  items,
  selectedValue,
  onValueChange,
  placeholder = "Select an option"
}: CustomDropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedItem = items.find(item => item.value === selectedValue);

  return (
    <View>
      <Pressable
        className="h-12 border border-hairline rounded-lg bg-canvas flex-row items-center justify-between px-3"
        onPress={() => setModalVisible(true)}
      >
        <Text className={selectedItem ? "text-ink" : "text-mute"}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <ChevronDown size={20} color="#888888" />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          className="flex-1 justify-center bg-black/50 p-4"
          onPress={() => setModalVisible(false)}
        >
          <View 
            className="bg-canvas rounded-xl shadow-card max-h-[70%] overflow-hidden"
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <View className="p-4 border-b border-hairline bg-canvas-soft-1">
              <Text className="font-bold text-lg text-ink">Select Option</Text>
            </View>
            <ScrollView className="p-2">
              {items.map((item) => (
                <Pressable
                  key={item.value}
                  className={`flex-row items-center justify-between p-4 rounded-lg mb-1 ${
                    selectedValue === item.value ? 'bg-primary/10' : 'bg-canvas'
                  }`}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text 
                    className={`text-base ${
                      selectedValue === item.value ? 'text-primary font-medium' : 'text-ink'
                    }`}
                  >
                    {item.label}
                  </Text>
                  {selectedValue === item.value && (
                    <Check size={20} color="#0055ff" /> // Assuming primary color or use currentColor
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}