'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  DocumentCheckIcon,
  StarIcon,
  TrophyIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  EyeIcon,
  BackspaceIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '../store/adminStore';
import { Card } from '../components/common/Card';
import { Dropdown } from '../components/common/Dropdown';
import { ParticipantDropdown } from '../components/common/ParticipantDropdown';
import { BBB26Export, HighlightState, ParedaoState, VotingStatus, AdminDatabase } from '../models/types';

type CurrentWeek = AdminDatabase['currentWeek'];
type WeekSnapshot = Pick<CurrentWeek, 'highlights' | 'paredao' | 'paredaoState' | 'votingStatus'>;

type ValidationIssue = {
  path?: string;
  field: string;
  issue?: string;
  original?: string;
  normalized?: string;
  received?: string;
  expected?: string;
};

// Função helper para normalizar validation issues para formato consistente
const normalizeValidationIssues = (rawIssues: any[]): ValidationIssue[] => {
  return rawIssues.map(issue => ({
    path: issue.path || '',
    field: issue.field || 'unknown',
    issue: issue.issue || '',
    original: issue.original,
    normalized: issue.normalized,
    received: issue.received,
    expected: issue.expected,
  }));
};

type ImportDiffChange = {
  type: 'added' | 'removed' | 'changed';
  highlight?: any;
  slot?: any;
  before?: any;
  after?: any;
  participantName: string | { before: string; after: string };
};

type ImportDiff = {
  highlights: {
    before: number;
    after: number;
    changes: ImportDiffChange[];
  };
  paredao: {
    before: number;
    after: number;
    changes: ImportDiffChange[];
  };
  states: {
    paredaoState: { before: ParedaoState; after: ParedaoState; changed: boolean };
    votingStatus: { before: VotingStatus; after: VotingStatus; changed: boolean };
  };
} | null;
import { getParticipantImage } from '../utils/avatarUtils';
import { exportToBBB26, importFromBBB26, downloadFile, formatJSON, BBB26ImportError, BBB26ImportMode } from '../services/exportService';
import { saveAdminDatabase } from '../services/storageService';
import { useParticipantValidation } from '../hooks/useParticipantValidation';
import { useVersioning } from '../hooks/useVersioning';
import { useNotifications } from '../hooks/useNotifications';
import { createInitialDatabase } from '../store/adminStore';
import { ToastContainer } from '../components/ui/Toast';
import ModalConfirm from '../components/ui/ModalConfirm';

const HIGHLIGHT_TYPES = [
  { id: 'leader', label: 'Líder', icon: TrophyIcon },
  { id: 'angel', label: 'Anjo', icon: StarIcon },
  { id: 'imune', label: 'Imune', icon: CheckCircleIcon },
  { id: 'monstro', label: 'Monstro', icon: ExclamationTriangleIcon },
];

const PAREDAO_STATES: { value: ParedaoState; label: string }[] = [
  { value: 'NOT_FORMED', label: 'Não formado' },
  { value: 'FORMED', label: 'Formado' },
  { value: 'VOTING', label: 'Em votação' },
  { value: 'FINISHED', label: 'Finalizado' },
];

const VOTING_STATUSES: { value: VotingStatus; label: string }[] = [
  { value: 'CLOSED', label: 'Fechada' },
  { value: 'OPEN', label: 'Aberta' },
  { value: 'FINISHED', label: 'Finalizada' },
];

export const BBB26Editor: React.FC = () => {
  const router = useRouter();
  const { database, setDatabase, updateDatabase } = useAdminStore();
  const { validateParticipantForCurrentWeek, getParticipantOptions, getParticipantName } = useParticipantValidation();
  const { saveVersion, getVersionsByType, restoreVersion } = useVersioning();

  const [isLoading, setIsLoading] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [importedData, setImportedData] = useState<BBB26Export | null>(null);
  const [importValidationIssues, setImportValidationIssues] = useState<ValidationIssue[]>([]);
  const [importDiff, setImportDiff] = useState<ImportDiff>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  // Estados para controle do modal de preview
  type PreviewSection = 'highlights' | 'paredao';
  const [expandedSections, setExpandedSections] = useState<Set<PreviewSection>>(new Set(['highlights', 'paredao']));

  // Estados para notificações e confirmações
  const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } = useNotifications();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmButtonColor?: 'blue' | 'red' | 'green';
  } | null>(null);

  // Banner de mudanças não salvas
  const [showUnsavedBanner, setShowUnsavedBanner] = useState(false);

  const toggleSection = useCallback((section: PreviewSection) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);


  // Funções auxiliares para confirmações
  const showConfirmDialog = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmButtonColor: 'blue' | 'red' | 'green' = 'blue'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText,
      confirmButtonColor,
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmModal(null);
  }, []);

  // Estado para controle de alterações e undo

  // Dirty fields para indicadores precisos por campo
  type DirtyField = 'highlights' | 'paredao' | 'paredaoState' | 'votingStatus';
  const [dirtyFields, setDirtyFields] = useState<Set<DirtyField>>(new Set());

  // Dirty por ID específico para indicadores mais precisos
  const [dirtyHighlightIds, setDirtyHighlightIds] = useState<Set<string>>(new Set());
  const [dirtySlotIds, setDirtySlotIds] = useState<Set<string>>(new Set());

  const [undoStack, setUndoStack] = useState<WeekSnapshot[]>([]);

  // Derivar hasLocalChanges do estado real do undo stack (mais consistente)
  const hasLocalChanges = undoStack.length > 0;
  const hasLoadedInitialDataRef = useRef(false);
  const wasEditingRef = useRef(isEditing);

  // Funções para gerenciar alterações e undo

  // Ref para controlar se houve mudança real
  const didChangeRef = useRef(false);

  // Ref para lock de importação (evita race conditions)
  const importLockRef = useRef(false);

  const undo = useCallback(() => {
    setUndoStack(prevStack => {
      if (prevStack.length === 0) return prevStack;

      const last = prevStack[prevStack.length - 1];
      if (!last) return prevStack;

      updateDatabase(currentDb => {
        if (!currentDb?.currentWeek) return currentDb;
        return {
          ...currentDb,
          currentWeek: {
            ...currentDb.currentWeek,
            highlights: last.highlights,
            paredao: last.paredao,
            paredaoState: last.paredaoState,
            votingStatus: last.votingStatus,
          },
        };
      });

      const newLength = prevStack.length - 1;
      if (newLength === 0) {
        setDirtyFields(new Set()); // Limpar dirty fields quando voltar ao estado inicial
        setDirtyHighlightIds(new Set());
        setDirtySlotIds(new Set());
      }
      return prevStack.slice(0, -1);
    });
  }, [updateDatabase]);

  // Carregar dados automaticamente ao abrir a tela (só uma vez)
  useEffect(() => {
    if (hasLoadedInitialDataRef.current) return;
    hasLoadedInitialDataRef.current = true;

    const loadInitialData = async () => {
      try {
        // Carregar dados automaticamente sem abrir modal de preview
        const [bbb26Response, participantsResponse] = await Promise.all([
          fetch('/bbb26.json'),
          fetch('/participants-status.json')
        ]);

        if (!bbb26Response.ok || !participantsResponse.ok) {
          throw new Error('Arquivos bbb26.json ou participants-status.json não encontrados');
        }

        const [bbb26Content, participantsContent] = await Promise.all([
          bbb26Response.text(),
          participantsResponse.text()
        ]);

        const bbb26Data = await importFromBBB26(
          new File([bbb26Content], 'bbb26.json', { type: 'application/json' })
        );

        const participantsData = JSON.parse(participantsContent);

        const participants: Record<string, any> = {};
        Object.entries(participantsData.participants || {}).forEach(([id, data]: [string, any]) => {
          const displayName = id
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          participants[id] = {
            id,
            name: displayName,
            status: data?.status || 'ATIVO',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });

        // Criar database completo com dados carregados
        const loadedDatabase = {
          version: 1,
          season: 26,
          participants,
          currentWeek: {
            highlights: bbb26Data.highlights || [],
            paredao: bbb26Data.paredao || [],
            paredaoState: bbb26Data.paredaoState || 'NOT_FORMED',
            votingStatus: bbb26Data.votingStatus || 'CLOSED',
            updatedAt: bbb26Data.updatedAt || new Date().toISOString(),
            importHash: (bbb26Data as any)._importHash,
          },
          history: {
            paredoes: [],
            updatedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setDatabase(loadedDatabase);
      } catch (error) {
        // Se falhar, continuar normalmente - pode não ter arquivo ou erro de rede
        console.log('Não foi possível carregar dados automaticamente:', error);
      }
    };

    loadInitialData();
  }, [updateDatabase]);

  // Limpar undo stack quando entra no modo edição
  useEffect(() => {
    const wasEditing = wasEditingRef.current;
    if (!wasEditing && isEditing && database?.currentWeek) {
      setUndoStack([]);
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, database?.currentWeek]);

  // Handlers para drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Funções de edição
  const updateHighlight = useCallback((highlightId: string, participantId: string, state?: HighlightState) => {
    didChangeRef.current = false;

    // Criar snapshot antes do update (mais seguro)
    const currentSnapshot = database?.currentWeek ? structuredClone({
      highlights: database.currentWeek.highlights,
      paredao: database.currentWeek.paredao,
      paredaoState: database.currentWeek.paredaoState,
      votingStatus: database.currentWeek.votingStatus,
    }) : null;

    updateDatabase(prev => {
      if (!prev?.currentWeek) return prev;

      const old = prev.currentWeek.highlights.find(h => h.id === highlightId);
      const nextParticipantId = participantId || '';
      const nextState = state ?? (nextParticipantId ? 'CONFIRMED' : 'PENDING');

      if (old && old.participantId === nextParticipantId && old.state === nextState) {
        return prev; // nada mudou => não salva undo, não marca dirty
      }

      didChangeRef.current = true;

      const updatedHighlights = prev.currentWeek.highlights.map(highlight =>
        highlight.id === highlightId
          ? {
              ...highlight,
              participantId: nextParticipantId,
              state: nextState,
            }
          : highlight
      );

      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          highlights: updatedHighlights,
        },
      };
    });

    // Salvar undo fora do updater (mais seguro)
    if (didChangeRef.current && currentSnapshot) {
      const snap: WeekSnapshot = currentSnapshot;
      setUndoStack(prev => {
        const next = [...prev, snap];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    }

    if (!didChangeRef.current) return;

    // Marcar alteração apenas se realmente mudou
    setDirtyFields(prev => new Set(prev).add('highlights'));
    setDirtyHighlightIds(prev => new Set(prev).add(highlightId));
  }, [database, updateDatabase]);

  const updateParedaoSlot = useCallback((slotId: string, participantId: string) => {
    didChangeRef.current = false;

    // Criar snapshot antes do update (mais seguro)
    const currentSnapshot = database?.currentWeek ? structuredClone({
      highlights: database.currentWeek.highlights,
      paredao: database.currentWeek.paredao,
      paredaoState: database.currentWeek.paredaoState,
      votingStatus: database.currentWeek.votingStatus,
    }) : null;

    updateDatabase(prev => {
      if (!prev?.currentWeek) return prev;

      const old = prev.currentWeek.paredao.find(s => s.id === slotId);
      const nextParticipantId = participantId || '';

      if (old && old.participantId === nextParticipantId) {
        return prev; // nada mudou => não salva undo, não marca dirty
      }

      didChangeRef.current = true;

      const updatedParedao = prev.currentWeek.paredao.map(slot =>
        slot.id === slotId
          ? { ...slot, participantId: nextParticipantId }
          : slot
      );

      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          paredao: updatedParedao,
        },
      };
    });

    // Salvar undo fora do updater (mais seguro)
    if (didChangeRef.current && currentSnapshot) {
      const snap: WeekSnapshot = currentSnapshot;
      setUndoStack(prev => {
        const next = [...prev, snap];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    }

    if (!didChangeRef.current) return;

    // Marcar alteração apenas se realmente mudou
    setDirtyFields(prev => new Set(prev).add('paredao'));
    setDirtySlotIds(prev => new Set(prev).add(slotId));
  }, [database, updateDatabase]);

  const updateParedaoState = useCallback((state: ParedaoState) => {
    didChangeRef.current = false;

    // Criar snapshot antes do update (mais seguro)
    const currentSnapshot = database?.currentWeek ? structuredClone({
      highlights: database.currentWeek.highlights,
      paredao: database.currentWeek.paredao,
      paredaoState: database.currentWeek.paredaoState,
      votingStatus: database.currentWeek.votingStatus,
    }) : null;

    updateDatabase(prev => {
      if (!prev?.currentWeek) return prev;

      if (prev.currentWeek.paredaoState === state) {
        return prev; // nada mudou => não salva undo, não marca dirty
      }

      didChangeRef.current = true;

      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          paredaoState: state,
        },
      };
    });

    // Salvar undo fora do updater (mais seguro)
    if (didChangeRef.current && currentSnapshot) {
      const snap: WeekSnapshot = currentSnapshot;
      setUndoStack(prev => {
        const next = [...prev, snap];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    }

    if (!didChangeRef.current) return;

    // Marcar alteração apenas se realmente mudou
    setDirtyFields(prev => new Set(prev).add('paredaoState'));
  }, [database, updateDatabase]);

  const updateVotingStatus = useCallback((status: VotingStatus) => {
    didChangeRef.current = false;

    // Criar snapshot antes do update (mais seguro)
    const currentSnapshot = database?.currentWeek ? structuredClone({
      highlights: database.currentWeek.highlights,
      paredao: database.currentWeek.paredao,
      paredaoState: database.currentWeek.paredaoState,
      votingStatus: database.currentWeek.votingStatus,
    }) : null;

    updateDatabase(prev => {
      if (!prev?.currentWeek) return prev;

      if (prev.currentWeek.votingStatus === status) {
        return prev; // nada mudou => não salva undo, não marca dirty
      }

      didChangeRef.current = true;

      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          votingStatus: status,
        },
      };
    });

    // Salvar undo fora do updater (mais seguro)
    if (didChangeRef.current && currentSnapshot) {
      const snap: WeekSnapshot = currentSnapshot;
      setUndoStack(prev => {
        const next = [...prev, snap];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    }

    if (!didChangeRef.current) return;

    // Marcar alteração apenas se realmente mudou
    setDirtyFields(prev => new Set(prev).add('votingStatus'));
  }, [database, updateDatabase]);

  // Calcular diferenças entre estado atual e dados importados
  const calculateImportDiff = useCallback((imported: BBB26Export): ImportDiff => {
    if (!database?.currentWeek) return null;

    // Cache local para otimizar getParticipantName em loops grandes
    const nameCache = new Map<string, string>();
    const nameOf = (id: string) => {
      if (!id) return '';
      if (nameCache.has(id)) return nameCache.get(id)!;
      const n = getParticipantName(id);
      nameCache.set(id, n);
      return n;
    };

    const current = database.currentWeek;
    const diff: ImportDiff = {
      highlights: {
        before: current.highlights.length,
        after: imported.highlights.length,
        changes: []
      },
      paredao: {
        before: current.paredao.length,
        after: imported.paredao.length,
        changes: []
      },
      states: {
        paredaoState: {
          before: current.paredaoState,
          after: imported.paredaoState,
          changed: current.paredaoState !== imported.paredaoState
        },
        votingStatus: {
          before: current.votingStatus,
          after: imported.votingStatus,
          changed: current.votingStatus !== imported.votingStatus
        }
      }
    };

    // Analisar mudanças nos highlights
    const currentHighlightIds = new Set(current.highlights.map(h => h.id));
    const importedHighlightIds = new Set(imported.highlights.map(h => h.id));

    // Novos highlights
    imported.highlights.forEach(h => {
      if (!currentHighlightIds.has(h.id)) {
        diff.highlights.changes.push({
          type: 'added',
          highlight: h,
          participantName: nameOf(h.participantId)
        });
      }
    });

    // Highlights removidos
    current.highlights.forEach(h => {
      if (!importedHighlightIds.has(h.id)) {
        diff.highlights.changes.push({
          type: 'removed',
          highlight: h,
          participantName: nameOf(h.participantId)
        });
      }
    });

    // Highlights alterados (mesmo ID, dados diferentes)
    imported.highlights.forEach(importedH => {
      const currentH = current.highlights.find(h => h.id === importedH.id);
      if (currentH) {
        const changed = currentH.participantId !== importedH.participantId ||
                       currentH.state !== importedH.state;
        if (changed) {
          diff.highlights.changes.push({
            type: 'changed',
            before: currentH,
            after: importedH,
            participantName: {
              before: nameOf(currentH.participantId),
              after: nameOf(importedH.participantId)
            }
          });
        }
      }
    });

    // Analisar mudanças no paredão
    const currentParedaoIds = new Set(current.paredao.map(p => p.id));
    const importedParedaoIds = new Set(imported.paredao.map(p => p.id));

    // Novos slots
    imported.paredao.forEach(p => {
      if (!currentParedaoIds.has(p.id)) {
        diff.paredao.changes.push({
          type: 'added',
          slot: p,
          participantName: nameOf(p.participantId)
        });
      }
    });

    // Slots removidos
    current.paredao.forEach(p => {
      if (!importedParedaoIds.has(p.id)) {
        diff.paredao.changes.push({
          type: 'removed',
          slot: p,
          participantName: nameOf(p.participantId)
        });
      }
    });

    // Slots alterados
    imported.paredao.forEach(importedP => {
      const currentP = current.paredao.find(p => p.id === importedP.id);
      if (currentP) {
        const changed = currentP.participantId !== importedP.participantId ||
                       currentP.position !== importedP.position ||
                       currentP.status !== importedP.status;
        if (changed) {
          diff.paredao.changes.push({
            type: 'changed',
            before: currentP,
            after: importedP,
            participantName: {
              before: nameOf(currentP.participantId),
              after: nameOf(importedP.participantId)
            }
          });
        }
      }
    });

    return diff;
  }, [database, getParticipantName]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Proteção contra múltiplos drops rápidos usando ref (mais robusto que state)
    if (importLockRef.current) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.json')) {
      showError('Arquivo inválido', 'Por favor, arraste apenas arquivos JSON.');
      return;
    }

    // Usar o mesmo fluxo do handleImport
    importLockRef.current = true;
    try {
      setIsLoading(true);

      // Modo LENIENT se Shift estiver pressionado
      const mode = e.shiftKey ? BBB26ImportMode.LENIENT : BBB26ImportMode.STRICT;

      const data = await importFromBBB26(file, mode);

      // Verificar se é uma reimportação
      const currentImportHash = database?.currentWeek?.importHash;
      const newImportHash = (data as any)._importHash;

      const proceedWithImport = () => {
        // Calcular diferenças para o preview
        const diff = calculateImportDiff(data);
        setImportDiff(diff);

        // Extrair warnings de validação
        const validation = (data as any)._validation || {};
        setImportValidationIssues(normalizeValidationIssues([
          ...(validation.typeIssues || []),
          ...(validation.warnings || [])
        ]));

        // Mostrar preview antes de confirmar
        setImportedData(data);
        setPreviewModalVisible(true);
      };

      // Verificar reimportação
      if (currentImportHash && newImportHash && currentImportHash === newImportHash) {
        showConfirmDialog(
          'Arquivo idêntico',
          'Este arquivo é idêntico aos dados atuais. Deseja importar mesmo assim?',
          () => {
            proceedWithImport();
            closeConfirmDialog();
          },
          'Importar mesmo assim',
          'Cancelar'
        );
        return;
      }

      proceedWithImport();

    } catch (error) {
      // Mostrar mensagem amigável baseada no tipo de erro
      let userMessage = 'Erro desconhecido na importação';

      if (error instanceof BBB26ImportError) {
        userMessage = error.userMessage;
        console.error('🔍 Detalhes do erro:', {
          code: error.code,
          userMessage: error.userMessage,
          details: error.details,
          fieldPath: error.fieldPath
        });
      } else if (error instanceof Error) {
        userMessage = error.message;
      }

      showError('Erro na importação', userMessage);
    } finally {
      setIsLoading(false);
      importLockRef.current = false;
    }
  }, [
    database,
    calculateImportDiff,
    showError,
    showConfirmDialog,
    closeConfirmDialog,
    setImportDiff,
    setImportValidationIssues,
    setImportedData,
    setPreviewModalVisible,
    setIsLoading
  ]);

  // Converte o estado atual para o formato de export
  const currentData = useMemo(() => {
    if (!database) return null;
    return exportToBBB26(database);
  }, [database]);

  // Participantes ativos para dropdown
  const activeParticipants = useMemo(() => {
    return getParticipantOptions(false);
  }, [getParticipantOptions]);


  // Validações
  const getValidationErrors = useCallback(() => {
    const errors: string[] = [];

    if (!database) return errors;

    // Validação usando o hook de validação
    const allParticipantIds = [
      ...database.currentWeek.highlights.map(h => h.participantId).filter(Boolean),
      ...database.currentWeek.paredao.map(s => s.participantId).filter(Boolean),
    ] as string[];

    const validationResults = allParticipantIds.reduce((acc, id) => {
      acc[id] = validateParticipantForCurrentWeek(id);
      return acc;
    }, {} as { [id: string]: any });

    // Check highlights
    database.currentWeek.highlights.forEach(highlight => {
      if (highlight.participantId) {
        const validation = validationResults[highlight.participantId];
        if (!validation.isValid) {
          const participantName = getParticipantName(highlight.participantId);
          errors.push(`${participantName} não pode ser ${highlight.title} (${validation.errors.join(', ')})`);
        }
      }
    });

    // Check paredão
    database.currentWeek.paredao.forEach(slot => {
      if (slot.participantId) {
        const validation = validationResults[slot.participantId];
        if (!validation.isValid) {
          const participantName = getParticipantName(slot.participantId);
          errors.push(`${participantName} não pode estar no paredão (${validation.errors.join(', ')})`);
        }
      }
    });

    // Validação: estado do paredão vs votação
    if (database.currentWeek.votingStatus === 'OPEN' && database.currentWeek.paredaoState === 'NOT_FORMED') {
      errors.push('Não é possível abrir votação se o paredão não foi formado');
    }

    // Validação: mínimo de participantes no paredão quando formado
    const filledSlots = database.currentWeek.paredao.filter(slot => slot.participantId).length;
    if (database.currentWeek.paredaoState === 'FORMED' && filledSlots < 2) {
      errors.push('Paredão formado deve ter pelo menos 2 participantes');
    }

    return errors;
  }, [database, validateParticipantForCurrentWeek, getParticipantName]);

  // Importação rápida do bbb26.json da raiz do projeto
  const handleQuickImport = async (e?: React.MouseEvent) => {
    const shiftKey = !!e?.shiftKey;
    try {
      setIsLoading(true);

      // Tentar fazer uma requisição fetch para o arquivo bbb26.json na raiz
      const response = await fetch('/bbb26.json');

      if (!response.ok) {
        throw new Error(`Arquivo bbb26.json não encontrado (HTTP ${response.status})`);
      }

      const content = await response.text();

      // Modo LENIENT se Shift estiver pressionado (recurso oculto)
      const mode = shiftKey ? BBB26ImportMode.LENIENT : BBB26ImportMode.STRICT;

      // Processar e validar dados usando importFromBBB26
      const data = await importFromBBB26(new File([content], 'bbb26.json', { type: 'application/json' }), mode);

      // Verificar se é uma reimportação
      const currentImportHash = database?.currentWeek?.importHash;
      const newImportHash = (data as any)._importHash;

      const proceedWithQuickImport = () => {
        // Calcular diferenças para o preview
        const diff = calculateImportDiff(data);
        setImportDiff(diff);

        // Extrair warnings de validação
        const validation = (data as any)._validation || {};
        setImportValidationIssues(normalizeValidationIssues([
          ...(validation.typeIssues || []),
          ...(validation.warnings || [])
        ]));

        // Mostrar preview antes de confirmar
        setImportedData(data);
        setPreviewModalVisible(true);
      };

      if (currentImportHash && newImportHash && currentImportHash === newImportHash) {
        showConfirmDialog(
          'Arquivo idêntico',
          'O arquivo bbb26.json é idêntico aos dados atuais. Deseja importar mesmo assim?',
          () => {
            proceedWithQuickImport();
            closeConfirmDialog();
          },
          'Importar mesmo assim',
          'Cancelar'
        );
        return;
      }

      proceedWithQuickImport();

    } catch (error) {
      console.error('Erro na importação rápida:', error);

      // Fallback: informar ao usuário e abrir seletor normal
      showConfirmDialog(
        'Erro na importação automática',
        `Não foi possível importar automaticamente o bbb26.json da raiz.\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}\n\nDeseja abrir o seletor de arquivos para escolher manualmente?`,
        () => {
          handleImport();
          closeConfirmDialog();
        },
        'Abrir seletor',
        'Cancelar'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Importar do arquivo (seletor manual)
  const handleImport = async (e?: React.MouseEvent) => {
    const shiftKey = !!e?.shiftKey;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setIsLoading(true);

        // Modo LENIENT se Shift estiver pressionado (recurso oculto)
        const mode = shiftKey
          ? BBB26ImportMode.LENIENT
          : BBB26ImportMode.STRICT;

        const data = await importFromBBB26(file, mode);

        // Extrair informações de validação
        const validationData = (data as any)._validation || {};
        setImportValidationIssues(normalizeValidationIssues([
          ...(validationData.typeIssues || []),
          ...(validationData.warnings || [])
        ]));

        // Verificar se é uma reimportação
        const currentImportHash = database?.currentWeek?.importHash;
        const newImportHash = (data as any)._importHash;

        if (currentImportHash && newImportHash && currentImportHash === newImportHash) {
          showConfirmDialog(
            'Arquivo idêntico',
            'Este arquivo é idêntico ao já importado nesta semana. Deseja importar mesmo assim?',
            () => {
              // Calcular diferenças para o preview
              const diff = calculateImportDiff(data);
              setImportDiff(diff);

              // Extrair warnings de validação
              const validation = (data as any)._validation || {};
              setImportValidationIssues(normalizeValidationIssues([
                ...(validation.typeIssues || []),
                ...(validation.warnings || [])
              ]));

              // Mostrar preview antes de confirmar
              setImportedData(data);
              setPreviewModalVisible(true);
              closeConfirmDialog();
            },
            'Importar mesmo assim',
            'Cancelar'
          );
          return;
        }

        // Calcular diferenças para o preview
        const diff = calculateImportDiff(data);
        setImportDiff(diff);

        // Extrair warnings de validação
        const validation = (data as any)._validation || {};
        setImportValidationIssues(normalizeValidationIssues([
          ...(validation.typeIssues || []),
          ...(validation.warnings || [])
        ]));

        // Mostrar preview antes de confirmar
        setImportedData(data);
        setPreviewModalVisible(true);
      } catch (error) {
        // Mostrar mensagem amigável baseada no tipo de erro
        let userMessage = 'Erro desconhecido na importação';

        if (error instanceof BBB26ImportError) {
          userMessage = error.userMessage;

          // Log detalhado para desenvolvedor (apenas no console)
          console.error('🔍 Detalhes do erro de importação:', {
            code: error.code,
            userMessage: error.userMessage,
            details: error.details
          });
        } else if (error instanceof Error) {
          userMessage = error.message;
        }

        showError('Erro na importação', userMessage);
      } finally {
        setIsLoading(false);
      }
    };

    input.click();
  };

  // Confirmar importação após preview
  const handleConfirmImport = () => {
    if (!importedData || !database?.currentWeek) return;

    try {
        // Salvar estado anterior antes do replace completo (só se há estado válido)
        if (database?.currentWeek) {
          const snap: WeekSnapshot = structuredClone({
            highlights: database.currentWeek.highlights,
            paredao: database.currentWeek.paredao,
            paredaoState: database.currentWeek.paredaoState,
            votingStatus: database.currentWeek.votingStatus,
          });
          setUndoStack(prev => {
            const next = [...prev, snap];
            return next.length > 30 ? next.slice(next.length - 30) : next;
          });
        }

        // Aplicar os dados importados na currentWeek (REPLACE mode)
        updateDatabase(prev => {
          const base = prev ?? createInitialDatabase();
          return {
            ...base,
            currentWeek: {
              ...base.currentWeek,
              highlights: importedData.highlights,
              paredao: importedData.paredao,
              paredaoState: importedData.paredaoState,
              votingStatus: importedData.votingStatus,
              updatedAt: importedData.updatedAt,
              importHash: (importedData as any)._importHash, // Para idempotência
            },
          };
        });

      // Fechar modal e limpar dados
      setPreviewModalVisible(false);
      setImportedData(null);
      setImportValidationIssues([]);

      // Resetar indicadores após importação
      setDirtyFields(new Set());
      setDirtyHighlightIds(new Set());
      setDirtySlotIds(new Set());

      showSuccess('Importação concluída', 'Dados da semana atual importados com sucesso!');
    } catch (error) {
      showError('Erro ao aplicar importação', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  // Cancelar importação
  const handleCancelImport = () => {
    setPreviewModalVisible(false);
    setImportedData(null);
    setImportValidationIssues([]);
  };

  // Salvar
  const handleSave = useCallback(async () => {
    if (!database) return;

    // Validar antes de salvar
    const errors = getValidationErrors();
    if (errors.length > 0) {
      showError('Erros de validação', `Corrija os seguintes erros:\n\n${errors.join('\n')}`);
      return;
    }

    try {
      setIsLoading(true);

      // Salvar versão anterior como backup
      const previousVersion = getVersionsByType('bbb26')[0];
      if (previousVersion) {
        await saveVersion(previousVersion.data, 'Backup automático antes de salvar', 'bbb26');
      }

      // Salvar dados atuais no banco local
      await saveAdminDatabase(database);

      // Exportar dados para formato BBB26
      const bbb26Data = exportToBBB26(database);

      // Salvar no arquivo bbb26.json via API
      const response = await fetch('/api/save-bbb26', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: bbb26Data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar arquivo');
      }

      // Criar nova versão
      await saveVersion(database, 'Semana atual atualizada', 'bbb26');

      // Resetar indicadores após salvar com sucesso
      setUndoStack([]);
      setDirtyFields(new Set());
      setDirtyHighlightIds(new Set());
      setDirtySlotIds(new Set());
      setShowUnsavedBanner(false);

      showSuccess('Dados salvos!', 'Arquivo bbb26.json atualizado automaticamente.');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showError('Erro ao salvar', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, [
    database,
    getValidationErrors,
    showError,
    getVersionsByType,
    saveVersion,
    saveAdminDatabase,
    exportToBBB26,
    setIsLoading,
    setUndoStack,
    setDirtyFields,
    setDirtyHighlightIds,
    setDirtySlotIds,
    setShowUnsavedBanner,
    showSuccess
  ]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + S - Salvar
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (!isLoading) {
          handleSave();
        }
        return;
      }

      // Ctrl/Cmd + Z - Desfazer (apenas no modo edição)
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (isEditing && undoStack.length > 0) {
          undo();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, isEditing, undoStack.length, undo, handleSave]);

  // Restaurar versão
  const handleRestoreVersion = async () => {
    const versions = getVersionsByType('bbb26');
    if (versions.length === 0) {
      showWarning('Nenhuma versão', 'Não há versões anteriores para restaurar.');
      return;
    }

    // Para simplificar, vamos restaurar a versão mais recente por enquanto
    // Em uma implementação completa, poderíamos ter um modal com lista de versões
    const latestVersion = versions[0];

    showConfirmDialog(
      'Restaurar versão',
      `ATENÇÃO: Isso irá restaurar os dados para:\n\n"${latestVersion.description}"\n\nTodos os dados atuais serão perdidos. Deseja continuar?`,
      async () => {
        try {
          setIsLoading(true);
          const restoredData = await restoreVersion(latestVersion.id);
          setDatabase(restoredData);
          setShowUnsavedBanner(false);
          showSuccess('Versão restaurada', 'Dados restaurados com sucesso!');
          closeConfirmDialog();
        } catch (error) {
          showError('Erro ao restaurar', 'Não foi possível restaurar a versão.');
        } finally {
          setIsLoading(false);
        }
      },
      'Restaurar',
      'Cancelar',
      'red'
    );
  };

  // Baixar JSON
  const handleDownload = () => {
    if (!currentData) return;

    const filename = `bbb26-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(filename, formatJSON(currentData));
  };

  const validationErrors = useMemo(() => getValidationErrors(), [getValidationErrors]);

  if (!database || !currentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDragOver
          ? 'bg-blue-50 border-4 border-dashed border-blue-300'
          : 'bg-gradient-to-b from-gray-50 to-white'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Banner de mudanças não salvas */}
      {showUnsavedBanner && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  Você tem alterações locais não salvas
                </h3>
                <div className="mt-2 text-sm text-amber-700">
                  <p>As modificações feitas permanecem no histórico de undo. Clique em "Editar" para continuar trabalhando.</p>
                </div>
              </div>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setShowUnsavedBanner(false)}
                  className="inline-flex bg-amber-50 rounded-md p-1.5 text-amber-500 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-amber-50 focus:ring-amber-600"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header - Desktop Only */}
      <header className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">Editor: bbb26.json</h1>
              <span className="hidden xl:inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                Semana atual
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Chips de status menores */}
              {isEditing && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5 animate-pulse"></span>
                  Editando
                </span>
              )}

              {hasLocalChanges && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
                  Alterações
                </span>
              )}

              {/* Botão primário: Salvar */}
              <button
                onClick={handleSave}
                disabled={isLoading || !hasLocalChanges}
                className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                  hasLocalChanges
                    ? 'border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 ring-2 ring-indigo-300 shadow-lg'
                    : 'border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                }`}
              >
                <DocumentCheckIcon className="h-4 w-4 mr-2" />
                Salvar
              </button>

              {/* Botões secundários */}
              <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Se está saindo do modo edição e tem alterações não salvas
                  if (isEditing && hasLocalChanges) {
                    showConfirmDialog(
                      'Alterações não salvas',
                      'Você tem alterações locais não salvas. Deseja sair do modo edição mesmo assim? As alterações serão mantidas no histórico de undo.',
                      () => {
                        setIsEditing(false);
                        setShowUnsavedBanner(true);
                        closeConfirmDialog();
                      },
                      'Sair mesmo assim',
                      'Continuar editando',
                      'red'
                    );
                    return;
                  }

                  // Se está entrando no modo edição vindo do modo visualização com banner
                  if (!isEditing && showUnsavedBanner) {
                    setShowUnsavedBanner(false);
                  }

                  setIsEditing(!isEditing);
                  if (!isEditing) {
                    // Entrando no modo edição - resetar indicadores
                    setUndoStack([]);
                    setDirtyFields(new Set());
                    setDirtyHighlightIds(new Set());
                    setDirtySlotIds(new Set());
                  }
                }}
                  className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    isEditing
                      ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:ring-indigo-500'
                      : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500'
                  }`}
                >
                  {isEditing ? (
                    <>
                      <EyeIcon className="h-4 w-4 mr-2" />
                      Visualizar
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Editar
                    </>
                  )}
                </button>

                <button
                  onClick={undo}
                  disabled={!isEditing || undoStack.length === 0}
                  className="inline-flex items-center px-3 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={
                    !isEditing
                      ? 'Entre no modo edição para desfazer alterações'
                      : undoStack.length === 0
                        ? 'Nenhuma ação para desfazer'
                        : `Desfazer última alteração (${undoStack.length} disponível(is))`
                  }
                >
                  ↶ Desfazer {undoStack.length > 0 && `(${undoStack.length})`}
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                <button
                  onClick={(e) => handleQuickImport(e)}
                  disabled={isLoading}
                  className="inline-flex items-center px-3 py-2 border border-blue-200 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Importar automaticamente o arquivo bbb26.json da raiz do projeto (mantenha Shift para modo LENIENT)"
                >
                  <DocumentCheckIcon className="h-4 w-4 mr-2" />
                  ⚡ bbb26.json
                </button>

                <button
                  onClick={(e) => handleImport(e)}
                  disabled={isLoading}
                  className="inline-flex items-center px-3 py-2 border border-gray-200 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Importar arquivo JSON (procure por bbb26.json na raiz do projeto)"
                >
                  <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                  Importar
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                <button
                  onClick={handleRestoreVersion}
                  disabled={isLoading}
                  className="inline-flex items-center px-3 py-2 border border-orange-200 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <BackspaceIcon className="h-4 w-4 mr-2" />
                  Restaurar
                </button>

                <button
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                  Baixar
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Header - Mobile Only */}
      <header className="lg:hidden bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-semibold text-gray-900">bbb26.json</h1>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={(e) => handleImport(e)}
                disabled={isLoading}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                title="Importar JSON"
              >
                <CloudArrowUpIcon className="h-5 w-5" />
              </button>

              <button
                onClick={handleSave}
                disabled={isLoading || !hasLocalChanges}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Salvar"
              >
                <DocumentCheckIcon className="h-5 w-5" />
              </button>

              <button
                onClick={handleDownload}
                disabled={isLoading}
                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md transition-colors"
                title="Baixar JSON"
              >
                <CloudArrowDownIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 sm:mx-6 lg:mx-8 mt-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erros de validação:</h3>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Seção A: Highlights (Destaques) */}
          <Card className={`bg-white border-gray-200 shadow-sm ${isEditing ? 'ring-1 ring-indigo-200' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <StarIcon className="h-6 w-6 text-yellow-600 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Highlights (Destaques)</h2>
              </div>
              {isEditing && (
                <span className="text-xs font-medium text-indigo-600">Editing</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {HIGHLIGHT_TYPES.map((highlightType) => {
                const highlight = database.currentWeek.highlights.find(h => h.type === highlightType.id.toUpperCase());
                if (!highlight) return null;

                const IconComponent = highlightType.icon;
                const participantName = highlight.participantId ? getParticipantName(highlight.participantId) : null;

                return (
                  <div key={highlight.id} className={`relative border border-gray-200 rounded-lg p-4 bg-white shadow-sm ${isEditing ? 'ring-1 ring-indigo-200' : ''}`}>
                    {/* Indicador de alteração específico */}
                    {dirtyHighlightIds.has(highlight.id) && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                        Alterado
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <IconComponent className="h-5 w-5 text-gray-600 mr-2" />
                        <span className="font-medium text-gray-900">{highlight.title}</span>
                      </div>

                      {isEditing && (
                        <div className="flex items-center space-x-2">
                          <Dropdown
                            options={[
                              { label: 'Pendente', value: 'PENDING' },
                              { label: 'Confirmado', value: 'CONFIRMED' },
                            ]}
                            value={highlight.state}
                            onValueChange={(value) => updateHighlight(highlight.id, highlight.participantId, value as HighlightState)}
                          />

                          <button
                            onClick={() => updateHighlight(highlight.id, '')}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Limpar destaque"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <ParticipantDropdown
                        options={[
                          { label: 'Nenhum', value: '' },
                          ...activeParticipants,
                        ]}
                        value={highlight.participantId}
                        onValueChange={(value) => updateHighlight(highlight.id, value)}
                        placeholder="Selecionar participante"
                      />
                    ) : (
                      highlight.participantId && participantName && participantName.trim() !== '' ? (
                        <div className="flex items-center mt-1">
                          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-200 mr-2">
                            <img
                              src={getParticipantImage(participantName)}
                              alt={participantName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-sm text-gray-900">{participantName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Não definido</span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Seção B: Paredão */}
          <Card className={`bg-white border-gray-200 shadow-sm ${isEditing ? 'ring-1 ring-red-200' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <TrophyIcon className="h-6 w-6 text-red-600 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Paredão</h2>
              </div>
              {isEditing && (
                <span className="text-xs font-medium text-red-600">Editing</span>
              )}
            </div>

            {/* Estado do Paredão */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {isEditing ? (
                <>
                  <div className="relative">
                    {/* Verificar se estado do paredão foi alterado */}
                    {dirtyFields.has('paredaoState') && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow z-10">
                        Alterado
                      </span>
                    )}
                    <Dropdown
                      label="Estado do Paredão"
                      options={PAREDAO_STATES}
                      value={database.currentWeek.paredaoState}
                      onValueChange={(value) => updateParedaoState(value as ParedaoState)}
                    />
                  </div>

                  <div className="relative">
                    {/* Verificar se status da votação foi alterado */}
                    {dirtyFields.has('votingStatus') && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow z-10">
                        Alterado
                      </span>
                    )}
                    <Dropdown
                      label="Status da Votação"
                      options={VOTING_STATUSES}
                      value={database.currentWeek.votingStatus}
                      onValueChange={(value) => updateVotingStatus(value as VotingStatus)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado do Paredão</label>
                    <div
                      className="text-sm text-gray-900 p-2 border border-gray-200 rounded-md bg-gray-50"
                      style={{ pointerEvents: 'none', opacity: 0.8 }}
                    >
                      {PAREDAO_STATES.find(s => s.value === database.currentWeek.paredaoState)?.label || database.currentWeek.paredaoState}
                    </div>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status da Votação</label>
                    <div
                      className="text-sm text-gray-900 p-2 border border-gray-200 rounded-md bg-gray-50"
                      style={{ pointerEvents: 'none', opacity: 0.8 }}
                    >
                      {VOTING_STATUSES.find(s => s.value === database.currentWeek.votingStatus)?.label || database.currentWeek.votingStatus}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Slots do Paredão */}
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-4">Participantes no Paredão</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {database.currentWeek.paredao.map((slot) => {
                  const participantName = slot.participantId ? getParticipantName(slot.participantId) : null;
                  return (
                  <div
                    key={slot.id}
                    className={`relative border border-gray-200 rounded-lg p-4 bg-white shadow-sm ${isEditing ? 'ring-1 ring-red-200' : ''}`}
                    style={!isEditing ? { pointerEvents: 'none', opacity: 0.8 } : undefined}
                  >
                    {/* Indicador de alteração específico */}
                    {dirtySlotIds.has(slot.id) && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                        Alterado
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Posição {slot.position}</span>
                      <span className={`text-sm px-2 py-1 rounded-full ${
                        slot.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                        slot.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {slot.status === 'CONFIRMED' ? 'Confirmado' :
                         slot.status === 'PENDING' ? 'Pendente' : 'Não formado'}
                      </span>
                    </div>

                    {isEditing ? (
                      <ParticipantDropdown
                        options={[
                          { label: 'Vazio', value: '' },
                          ...activeParticipants,
                        ]}
                        value={slot.participantId}
                        onValueChange={(value) => updateParedaoSlot(slot.id, value)}
                        placeholder="Selecionar participante"
                      />
                    ) : (
                      slot.participantId && participantName && participantName.trim() !== '' ? (
                        <div className="flex items-center mt-1">
                          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-200 mr-2">
                            <img
                              src={getParticipantImage(participantName)}
                              alt={participantName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-sm text-gray-900">{participantName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Vazio</span>
                      )
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Informações do arquivo */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <div className="text-sm text-gray-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium">Schema Version:</span>
                  <div>{currentData.schemaVersion}</div>
                </div>
                <div>
                  <span className="font-medium">Season:</span>
                  <div>{currentData.season}</div>
                </div>
                <div>
                  <span className="font-medium">Highlights:</span>
                  <div>{currentData.highlights.length}</div>
                </div>
                <div>
                  <span className="font-medium">Paredão:</span>
                  <div>{currentData.paredao.length} slots</div>
                </div>
              </div>
              <div className="mt-4">
                <span className="font-medium">Última atualização:</span>
                <div>{currentData.updatedAt ? new Date(currentData.updatedAt).toLocaleString('pt-BR') : 'Nunca'}</div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Modal de Preview da Importação */}
      {previewModalVisible && importedData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-start justify-center p-6">
          <div className="w-full max-w-4xl bg-white rounded-md shadow-lg border max-h-[80vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Preview da Importação BBB26</h3>
                <button
                  onClick={handleCancelImport}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Alerta de operação REPLACE */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-800">
                        Modo de Importação: REPLACE
                        {(importedData as any)?._importMode === BBB26ImportMode.LENIENT && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                            LENIENT
                          </span>
                        )}
                      </h4>
                      <div className="mt-1 text-sm text-blue-700">
                        <p>Esta operação irá <strong>substituir completamente</strong> todos os dados da semana atual.</p>
                        <p className="mt-1">Highlights, paredão e estados serão sobrescritos.</p>
                        {(importedData as any)?._importMode === BBB26ImportMode.LENIENT && (
                          <p className="mt-2 text-orange-600">
                            ⚠️ Modo LENIENT ativado: Pequenos desvios foram normalizados automaticamente.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Impacto da Importação - Sticky no topo */}
                {importDiff && (
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-4 shadow-sm z-10">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">📊 Impacto da Importação</h4>

                    {/* Resumo numérico */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <span className="font-medium">Highlights:</span>
                        <div className={`${importDiff.highlights.before !== importDiff.highlights.after ? 'text-orange-600 font-bold' : 'text-gray-900'}`}>
                          {importDiff.highlights.before} → {importDiff.highlights.after}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Paredão:</span>
                        <div className={`${importDiff.paredao.before !== importDiff.paredao.after ? 'text-orange-600 font-bold' : 'text-gray-900'}`}>
                          {importDiff.paredao.before} → {importDiff.paredao.after}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Estado Paredão:</span>
                        <div className={`${importDiff.states.paredaoState.changed ? 'text-orange-600 font-bold' : 'text-gray-900'}`}>
                          {importDiff.states.paredaoState.before} → {importDiff.states.paredaoState.after}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Status Votação:</span>
                        <div className={`${importDiff.states.votingStatus.changed ? 'text-orange-600 font-bold' : 'text-gray-900'}`}>
                          {importDiff.states.votingStatus.before} → {importDiff.states.votingStatus.after}
                        </div>
                      </div>
                    </div>

                    {/* Sem mudanças */}
                    {importDiff.highlights.changes.length === 0 && importDiff.paredao.changes.length === 0 &&
                     !importDiff.states.paredaoState.changed && !importDiff.states.votingStatus.changed && (
                      <div className="text-center py-2 border-t border-gray-200 mt-4">
                        <div className="text-green-600 font-medium">✅ Nenhuma mudança detectada</div>
                        <div className="text-sm text-green-700 mt-1">
                          Os dados são idênticos aos atuais
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detalhes das mudanças - Accordions */}
                {importDiff && (importDiff.highlights.changes.length > 0 || importDiff.paredao.changes.length > 0) && (
                  <div className="space-y-4">
                    {/* Mudanças nos highlights - Accordion */}
                    {importDiff.highlights.changes.length > 0 && (
                      <div className="border border-gray-200 rounded-lg">
                        <button
                          onClick={() => toggleSection('highlights')}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900">⭐ Mudanças nos Highlights</span>
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              {importDiff.highlights.changes.length}
                            </span>
                          </div>
                          <svg
                            className={`h-5 w-5 text-gray-500 transition-transform ${expandedSections.has('highlights') ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedSections.has('highlights') && (
                          <div className="px-4 pb-4">
                            <ul className="space-y-2 text-sm">
                              {importDiff.highlights.changes.map((change: any, index: number) => (
                                <li key={index} className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    change.type === 'added' ? 'bg-green-100 text-green-800' :
                                    change.type === 'removed' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {change.type === 'added' && '➕ ADDED'}
                                    {change.type === 'removed' && '➖ REMOVED'}
                                    {change.type === 'changed' && '🔄 CHANGED'}
                                  </span>
                                  <span className="font-medium">{change.highlight?.title || change.before?.title}</span>
                                  {change.type === 'changed' ? (
                                    <span>: {change.participantName.before} → {change.participantName.after}</span>
                                  ) : (
                                    <span>: {change.participantName}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mudanças no paredão - Accordion */}
                    {importDiff.paredao.changes.length > 0 && (
                      <div className="border border-gray-200 rounded-lg">
                        <button
                          onClick={() => toggleSection('paredao')}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900">🏆 Mudanças no Paredão</span>
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              {importDiff.paredao.changes.length}
                            </span>
                          </div>
                          <svg
                            className={`h-5 w-5 text-gray-500 transition-transform ${expandedSections.has('paredao') ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedSections.has('paredao') && (
                          <div className="px-4 pb-4">
                            <ul className="space-y-2 text-sm">
                              {importDiff.paredao.changes.map((change: any, index: number) => (
                                <li key={index} className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    change.type === 'added' ? 'bg-green-100 text-green-800' :
                                    change.type === 'removed' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {change.type === 'added' && '➕ ADDED'}
                                    {change.type === 'removed' && '➖ REMOVED'}
                                    {change.type === 'changed' && '🔄 CHANGED'}
                                  </span>
                                  <span className="font-medium">Posição {change.slot?.position || change.before?.position}</span>
                                  {change.type === 'changed' ? (
                                    <span>: {change.participantName.before || 'Vazio'} → {change.participantName.after || 'Vazio'}</span>
                                  ) : (
                                    <span>: {change.participantName || 'Vazio'}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Problemas de validação detectados */}
                {importValidationIssues.length > 0 && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-yellow-800">⚠️ Validação e Normalizações</h4>
                        <div className="mt-2 text-sm text-yellow-700">
                          <ul className="space-y-1">
                            {importValidationIssues.map((issue, index) => (
                              <li key={index} className="flex items-start">
                                {issue.issue ? (
                                  // Warning de normalização
                                  <span className="text-orange-600 mr-2">🔧</span>
                                ) : (
                                  // Erro de tipo
                                  <span className="text-yellow-600 mr-2">⚠️</span>
                                )}
                                <span>
                                  {issue.path && (
                                    <code className="bg-yellow-100 px-1 rounded text-xs mr-1">{issue.path}</code>
                                  )}
                                  {issue.field}: {
                                    issue.issue ? (
                                      // Descrição da normalização
                                      issue.issue === 'normalized_from_string' ?
                                        `Convertido de "${issue.original}" para ${issue.normalized}` :
                                      issue.issue === 'normalized_case' ?
                                        `Case normalizado: "${issue.original}" → "${issue.normalized}"` :
                                      issue.issue === 'unexpected_season' ?
                                        `Temporada ${issue.received} (esperado: ${issue.expected})` :
                                        `Normalizado: ${issue.issue}`
                                    ) : (
                                      // Erro de tipo
                                      `veio como "${issue.received}"; esperado "${issue.expected}"`
                                    )
                                  }
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs">
                            {(importedData as any)?._importMode === BBB26ImportMode.LENIENT
                              ? 'Modo LENIENT: Pequenos desvios foram normalizados automaticamente.'
                              : 'Modo STRICT: Todos os problemas foram detectados mas o processamento continuou.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Informações básicas */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Informações do Arquivo</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Schema:</span>
                      <div>v{importedData.schemaVersion}</div>
                    </div>
                    <div>
                      <span className="font-medium">Temporada:</span>
                      <div>BBB{importedData.season}</div>
                    </div>
                    <div>
                      <span className="font-medium">Highlights:</span>
                      <div>{importedData.highlights.length}</div>
                    </div>
                    <div>
                      <span className="font-medium">Paredão:</span>
                      <div>{importedData.paredao.length} slots</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="font-medium">Última atualização:</span>
                    <div>{new Date(importedData.updatedAt).toLocaleString('pt-BR')}</div>
                  </div>
                  {(importedData as any)._importHash && (
                    <div className="mt-2">
                      <span className="font-medium">Hash de Importação:</span>
                      <div className="font-mono text-xs bg-gray-200 p-1 rounded mt-1">
                        {(importedData as any)._importHash}
                      </div>
                    </div>
                  )}
                </div>

                {/* Highlights */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <StarIcon className="h-5 w-5 text-yellow-600 mr-2" />
                    Highlights Detectados
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {importedData.highlights.map((highlight) => {
                      const participantName = highlight.participantId ? getParticipantName(highlight.participantId) : null;
                      return (
                      <div key={highlight.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {highlight.participantId && participantName && participantName.trim() !== '' && (
                              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-3">
                                <img
                                  src={getParticipantImage(participantName)}
                                  alt={participantName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-gray-900">{highlight.title}</span>
                              <div className="text-sm text-gray-600">
                                {participantName || 'Não definido'}
                              </div>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            highlight.state === 'CONFIRMED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {highlight.state === 'CONFIRMED' ? 'Confirmado' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* Paredão */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <TrophyIcon className="h-5 w-5 text-red-600 mr-2" />
                    Paredão Detectado
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {importedData.paredao.map((slot) => {
                      const participantName = slot.participantId ? getParticipantName(slot.participantId) : null;
                      return (
                      <div key={slot.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {slot.participantId && participantName && participantName.trim() !== '' && (
                              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-3">
                                <img
                                  src={getParticipantImage(participantName)}
                                  alt={participantName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-gray-900">Posição {slot.position}</span>
                              <div className="text-sm text-gray-600">
                                {participantName || 'Vazio'}
                              </div>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">{slot.status}</span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* Estados */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Estados do Sistema</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Estado do Paredão:</span>
                      <div className={`inline-block ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        importedData.paredaoState === 'NOT_FORMED'
                          ? 'bg-gray-100 text-gray-800'
                          : importedData.paredaoState === 'FORMED'
                          ? 'bg-blue-100 text-blue-800'
                          : importedData.paredaoState === 'VOTING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {importedData.paredaoState === 'NOT_FORMED' ? 'Não formado' :
                         importedData.paredaoState === 'FORMED' ? 'Formado' :
                         importedData.paredaoState === 'VOTING' ? 'Em votação' : 'Finalizado'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Status da Votação:</span>
                      <div className={`inline-block ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        importedData.votingStatus === 'CLOSED'
                          ? 'bg-gray-100 text-gray-800'
                          : importedData.votingStatus === 'OPEN'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {importedData.votingStatus === 'CLOSED' ? 'Fechada' :
                         importedData.votingStatus === 'OPEN' ? 'Aberta' : 'Finalizada'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  🔄 Substituir Semana Atual
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de drag & drop */}
      {isDragOver && (
        <div className="fixed inset-0 bg-blue-500 bg-opacity-10 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-blue-300">
            <div className="text-center">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-blue-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Solte o arquivo JSON aqui
              </h3>
              <p className="text-sm text-gray-600">
                Arraste e solte um arquivo JSON para importar
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Mantenha Shift pressionado para modo LENIENT
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Modal de Confirmação */}
      {confirmModal && (
        <ModalConfirm
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          confirmButtonColor={confirmModal.confirmButtonColor}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirmDialog}
        />
      )}
    </div>
  );
};