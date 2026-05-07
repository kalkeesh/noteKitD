import React, { createContext, useContext } from 'react';

export const AuthContext = createContext({
  session: null,
  setSession: () => {},
  primaryApp: 'notekit',
  setPrimaryApp: () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
