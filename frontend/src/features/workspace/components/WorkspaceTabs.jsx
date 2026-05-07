import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TAB_BUDGETIFY, TAB_CALENDAR, TAB_NOTES, TAB_TODOS } from '../constants';
import { styles } from '../styles';

export default function WorkspaceTabs({ activeTab, onTabChange }) {
  return (
    <View style={styles.tabBar}>
      <Pressable
        style={[styles.tabBtn, activeTab === TAB_NOTES ? styles.tabBtnActive : null]}
        onPress={() => onTabChange(TAB_NOTES)}
      >
        <Text style={[styles.tabText, activeTab === TAB_NOTES ? styles.tabTextActive : null]}>Notes</Text>
      </Pressable>
      <Pressable
        style={[styles.tabBtn, activeTab === TAB_TODOS ? styles.tabBtnActive : null]}
        onPress={() => onTabChange(TAB_TODOS)}
      >
        <Text style={[styles.tabText, activeTab === TAB_TODOS ? styles.tabTextActive : null]}>Todo List</Text>
      </Pressable>
      <Pressable
        style={[styles.tabBtn, activeTab === TAB_CALENDAR ? styles.tabBtnActive : null]}
        onPress={() => onTabChange(TAB_CALENDAR)}
      >
        <Text style={[styles.tabText, activeTab === TAB_CALENDAR ? styles.tabTextActive : null]}>Calendar</Text>
      </Pressable>
      <Pressable
        style={[styles.tabBtn, activeTab === TAB_BUDGETIFY ? styles.tabBtnActive : null]}
        onPress={() => onTabChange(TAB_BUDGETIFY)}
      >
        <Text style={[styles.tabText, activeTab === TAB_BUDGETIFY ? styles.tabTextActive : null]}>Budgetify</Text>
      </Pressable>
    </View>
  );
}
