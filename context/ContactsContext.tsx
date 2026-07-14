"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import type { CardData } from "@/types/card";

interface ContactsContextType {
  contacts: CardData[];
  setContacts: React.Dispatch<React.SetStateAction<CardData[]>>;
  updateContact: (updatedContact: CardData) => void;
  addContact: (contact: CardData) => void;
  removeContact: (id: string) => void;
}

const ContactsContext =
  createContext<ContactsContextType | null>(null);

interface ContactsProviderProps {
  children: ReactNode;
  initialContacts?: CardData[];
}

export function ContactsProvider({
  children,
  initialContacts = [],
}: ContactsProviderProps) {
  const [contacts, setContacts] =
    useState<CardData[]>(initialContacts);

  const updateContact = (updatedContact: CardData) => {
    setContacts((previous) =>
      previous.map((contact) =>
        contact.id === updatedContact.id
          ? updatedContact
          : contact
      )
    );
  };

  const addContact = (contact: CardData) => {
    setContacts((previous) => [
      contact,
      ...previous,
    ]);
  };

  const removeContact = (id: string) => {
    setContacts((previous) =>
      previous.filter(
        (contact) => contact.id !== id
      )
    );
  };

  const value = useMemo(
    () => ({
      contacts,
      setContacts,
      updateContact,
      addContact,
      removeContact,
    }),
    [contacts]
  );

  return (
    <ContactsContext.Provider value={value}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const context = useContext(ContactsContext);

  if (!context) {
    throw new Error(
      "useContacts must be used inside ContactsProvider"
    );
  }

  return context;
}