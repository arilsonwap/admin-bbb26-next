'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { XMarkIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

interface ModalLogsProps {
  isOpen: boolean;
  title: string;
  logs: string;
  status: 'running' | 'success' | 'error';
  onClose: () => void;
}

const ModalLogs: React.FC<ModalLogsProps> = ({ isOpen, title, logs, status, onClose }) => {
  const logsTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Se o usuário estiver perto do fim, mantemos auto-scroll ligado.
  const shouldAutoScrollRef = useRef(true);

  // Mostrar botão "Ir pro fim"
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  // Guardar IDs pra cancelar agendamentos
  const rafIdsRef = useRef<number[]>([]);

  const cancelRafs = () => {
    rafIdsRef.current.forEach((id) => cancelAnimationFrame(id));
    rafIdsRef.current = [];
  };

  const scrollToBottom = () => {
    const el = logsTextareaRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  };

  const scheduleScrollToBottom = () => {
    cancelRafs();

    const run = () => {
      scrollToBottom();

      // Se o scroll programático não disparar evento "scroll" em algum browser,
      // garantimos o estado correto aqui:
      shouldAutoScrollRef.current = true;
      setShowJumpToBottom(false);
    };

    // 3 frames costuma cobrir: value mudou -> layout -> scrollbar recalculada
    rafIdsRef.current.push(requestAnimationFrame(run));
    rafIdsRef.current.push(requestAnimationFrame(run));
    rafIdsRef.current.push(requestAnimationFrame(run));
  };

  const jumpToBottom = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToBottom(false);
    scheduleScrollToBottom();
  };

  const isRunning = status === 'running';
  const isError = status === 'error';

  // Quando o modal abre, trava scroll do body (como você fez) + garante scroll no fim.
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'running') onClose();
    };

    document.addEventListener('keydown', handleEscape);

    // Ao abrir, assume auto-scroll ligado e rola pro fim
    shouldAutoScrollRef.current = true;
    setShowJumpToBottom(false); // ← Resetar estado do botão
    requestAnimationFrame(() => scheduleScrollToBottom());

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEscape);
      cancelRafs();
    };
  }, [isOpen, status, onClose]);

  // Listener de scroll: detecta se o usuário saiu do "perto do fim"
  useEffect(() => {
    const el = logsTextareaRef.current;
    if (!isOpen || !el) return;

    let alive = true; // ← Guard contra setState em componente desmontado

    const onScroll = () => {
      if (!alive) return; // ← Evita setState se componente desmontou

      // tolerância de 24px (ajuste se quiser)
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      const nearBottom = distanceFromBottom < 24;

      shouldAutoScrollRef.current = nearBottom;
      setShowJumpToBottom(!nearBottom);
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    // Calibra depois que o primeiro scroll programático tiver chance de acontecer
    requestAnimationFrame(() => {
      if (alive) onScroll();
    });
    return () => {
      alive = false;
      el.removeEventListener('scroll', onScroll);
    };
  }, [isOpen]);

  // Aqui é o "pulo do gato":
  // useLayoutEffect roda depois do React escrever no DOM, antes de pintar.
  useLayoutEffect(() => {
    if (!isOpen) return;

    // Quando não está executando, sempre força scroll para o final
    // (garante que modal termine mostrando o resultado final)
    if (!isRunning) {
      shouldAutoScrollRef.current = true;
    }

    if (!shouldAutoScrollRef.current) return;

    scheduleScrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, isOpen, isRunning]);

  // Reset do botão quando execução termina (evita setState em layout effect)
  useEffect(() => {
    if (!isOpen) return;
    if (status === 'running') return;

    setShowJumpToBottom(false);
    requestAnimationFrame(() => scheduleScrollToBottom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="deploy-modal-title">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={!isRunning ? onClose : undefined}
        />

        {/* Modal panel */}
        <div
          className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
                <CloudArrowUpIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 id="deploy-modal-title" className="text-lg font-medium leading-6 text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={[
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        isRunning
                          ? "bg-yellow-100 text-yellow-800"
                          : isError
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800",
                      ].join(" ")}
                    >
                      {isRunning ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600 mr-1"></div>
                          Executando...
                        </>
                      ) : isError ? (
                        "Falhou"
                      ) : (
                        "Concluído"
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {!isRunning && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 px-4 py-4 sm:px-6">
            <div className="relative">
              <textarea
                ref={logsTextareaRef}
                value={logs}
                readOnly
                className="w-full h-96 bg-gray-900 text-green-400 font-mono text-sm p-4 rounded border border-gray-700 focus:outline-none resize-none overflow-y-auto"
                placeholder="Logs do queridômetro aparecerão aqui..."
                style={{
                  fontFamily: 'monospace',
                  lineHeight: '1.4',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4B5563 #1F2937'
                }}
                aria-describedby="deploy-modal-title"
              />

              {showJumpToBottom && !shouldAutoScrollRef.current && (
                <button
                  type="button"
                  onClick={jumpToBottom}
                  className="absolute bottom-3 right-3 rounded-md bg-gray-800/90 text-gray-100 text-xs px-3 py-2 border border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  ⬇ Ir pro fim
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          {!isRunning && (
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalLogs;