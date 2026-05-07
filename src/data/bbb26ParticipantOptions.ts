/** Lista única de participantes BBB26 para pickers (enquetes, produtos, etc.). */
export const BBB26_PARTICIPANT_OPTIONS = [
  // CAMAROTE
  { id: 'aline-campos', name: 'Aline Campos' },
  { id: 'edilson', name: 'Edílson' },
  { id: 'henri-castelli', name: 'Henri Castelli' },
  { id: 'juliano-floss', name: 'Juliano Floss' },
  { id: 'solange-couto', name: 'Solange Couto' },

  // VETERANOS
  { id: 'alberto-cowboy', name: 'Alberto "Cowboy"' },
  { id: 'ana-paula-renault', name: 'Ana Paula Renault' },
  { id: 'babu-santana', name: 'Babu Santana' },
  { id: 'jonas-sulzbach', name: 'Jonas Sulzbach' },
  { id: 'sarah-andrade', name: 'Sarah Andrade' },
  { id: 'sol-vega', name: 'Sol Vega' },

  // PIPOCA
  { id: 'brigido', name: 'Brígido' },
  { id: 'breno', name: 'Breno' },
  { id: 'chaiany', name: 'Chaiany' },
  { id: 'gabriela', name: 'Gabriela' },
  { id: 'jordana', name: 'Jordana' },
  { id: 'leandro', name: 'Leandro' },
  { id: 'marcelo', name: 'Marcel' },
  { id: 'marciele', name: 'Marciele' },
  { id: 'matheus', name: 'Matheus' },
  { id: 'maxiane', name: 'Maxiane' },
  { id: 'milena', name: 'Milena' },
  { id: 'paulo-augusto', name: 'Paulo Augusto' },
  { id: 'samira', name: 'Samira' },
] as const;

export type Bbb26ParticipantOption = (typeof BBB26_PARTICIPANT_OPTIONS)[number];
