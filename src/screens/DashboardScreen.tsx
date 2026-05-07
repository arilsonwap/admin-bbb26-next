'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownTrayIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  CloudArrowUpIcon,
  CubeIcon,
  DevicePhoneMobileIcon,
  FolderIcon,
  GlobeAltIcon,
  HomeIcon,
  PhotoIcon,
  QuestionMarkCircleIcon,
  RocketLaunchIcon,
  TrophyIcon,
  UserMinusIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import ModalLogs from '../components/ui/ModalLogs';
import { useDeployInfo } from '../hooks/useDeployInfo';

type DashboardToolLink = {
  kind: 'link';
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  subtitle: string;
  ring: string;
  /** estilo tracejado (ex.: debug) */
  muted?: boolean;
};

type DashboardToolDeploy = {
  kind: 'deploy';
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  subtitle: string;
  ring: string;
};

type DashboardToolLocalVpsJson = {
  kind: 'localVpsJsonSync';
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  subtitle: string;
  ring: string;
};

type DashboardTool = (DashboardToolLink | DashboardToolDeploy | DashboardToolLocalVpsJson) & {
  used: boolean;
};

/** Ajuste `used` conforme o que o time usa no dia a dia. */
const DASHBOARD_TOOLS: DashboardTool[] = [
  { used: true, kind: 'link', href: '/queridometro', icon: ChartBarIcon, iconColor: 'text-purple-600', title: 'Queridômetro', subtitle: 'Gerar dados', ring: 'focus:ring-purple-500' },
  { used: true, kind: 'link', href: '/resumodojogo', icon: UsersIcon, iconColor: 'text-green-600', title: 'Resumo do jogo', subtitle: 'Status participantes', ring: 'focus:ring-green-500' },
  { used: true, kind: 'link', href: '/paredao-results', icon: TrophyIcon, iconColor: 'text-red-600', title: 'Paredão', subtitle: 'paredao-results.json', ring: 'focus:ring-red-500' },
  { used: true, kind: 'link', href: '/news', icon: GlobeAltIcon, iconColor: 'text-blue-600', title: 'Notícias (gshow)', subtitle: 'Buscar notícias BBB26', ring: 'focus:ring-blue-500' },
  { used: true, kind: 'link', href: '/polls', icon: QuestionMarkCircleIcon, iconColor: 'text-violet-600', title: 'Enquetes', subtitle: 'Listar / criar / editar', ring: 'focus:ring-violet-500' },
  { used: true, kind: 'link', href: '/admin/banners/dinamica', icon: PhotoIcon, iconColor: 'text-pink-600', title: 'Banners Dinâmica', subtitle: 'JSON público por seção', ring: 'focus:ring-pink-500' },
  { used: true, kind: 'link', href: '/admin/push', icon: BellAlertIcon, iconColor: 'text-amber-600', title: 'Push editorial', subtitle: 'Notificações / campanhas', ring: 'focus:ring-amber-500' },
  { used: true, kind: 'link', href: '/admin/app-version', icon: DevicePhoneMobileIcon, iconColor: 'text-indigo-600', title: 'Versão do app', subtitle: 'app-version.json', ring: 'focus:ring-indigo-500' },
  { used: true, kind: 'link', href: '/products', icon: CubeIcon, iconColor: 'text-indigo-600', title: 'Produtos', subtitle: 'products-status.json', ring: 'focus:ring-indigo-500' },
  { used: true, kind: 'deploy', icon: CloudArrowUpIcon, iconColor: 'text-orange-600', title: 'Deploy Firebase', subtitle: 'Hosting + logs', ring: 'focus:ring-orange-500' },
  {
    used: true,
    kind: 'localVpsJsonSync',
    icon: ArrowDownTrayIcon,
    iconColor: 'text-sky-600',
    title: 'Baixar JSONs do VPS',
    subtitle: 'LOCAL · rsync → tools/bbb-hosting/public',
    ring: 'focus:ring-sky-500',
  },
  { used: false, kind: 'link', href: '/backups', icon: FolderIcon, iconColor: 'text-yellow-600', title: 'Backups', subtitle: 'Histórico de backups', ring: 'focus:ring-yellow-600' },
  { used: false, kind: 'link', href: '/debug', icon: WrenchScrewdriverIcon, iconColor: 'text-gray-600', title: 'Debug', subtitle: 'Avatares / testes', ring: 'focus:ring-gray-400', muted: true },
];

const CASA_DO_PATRAO_TOOLS: DashboardToolLink[] = [
  {
    kind: 'link',
    href: '/casa-do-patrao',
    icon: HomeIcon,
    iconColor: 'text-orange-600',
    title: 'Visão geral',
    subtitle: 'Executar scraper + publicar',
    ring: 'focus:ring-orange-500',
  },
  {
    kind: 'link',
    href: '/ferramentas-utilizadas',
    icon: WrenchScrewdriverIcon,
    iconColor: 'text-gray-700',
    title: 'Barra (status)',
    subtitle: 'PATRÃO / TÁ NA RETA / PODER DO VOTO',
    ring: 'focus:ring-gray-500',
  },
  {
    kind: 'link',
    href: '/casa-do-patrao-conteudos',
    icon: GlobeAltIcon,
    iconColor: 'text-blue-600',
    title: 'Conteúdos',
    subtitle: 'Notícias, vídeos e fotos',
    ring: 'focus:ring-blue-500',
  },
  {
    kind: 'link',
    href: '/casa-do-patrao-eliminacao-results',
    icon: UserMinusIcon,
    iconColor: 'text-red-600',
    title: 'Eliminação',
    subtitle: 'casa-do-patrao-eliminacao-results.json',
    ring: 'focus:ring-red-500',
  },
  {
    kind: 'link',
    href: '/casa-do-patrao/historico',
    icon: ClockIcon,
    iconColor: 'text-indigo-700',
    title: 'Histórico / Ciclos',
    subtitle: 'Rebuild, placeholder e eventos',
    ring: 'focus:ring-indigo-600',
  },
];

type DashboardCardProps = {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  iconClassName: string;
  ringClassName: string;
  className: string;
  subtitleClassName?: string;
  disabled?: boolean;
  children?: React.ReactNode;
};

function DashboardCard({
  title,
  subtitle,
  onClick,
  Icon,
  iconClassName,
  ringClassName,
  className,
  subtitleClassName = 'text-xs text-gray-500 mt-1 text-center',
  disabled,
  children,
}: DashboardCardProps) {
  const baseBtn =
    'flex flex-col items-center justify-center px-4 py-6 border text-base font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[baseBtn, className, ringClassName, 'disabled:opacity-60 disabled:cursor-not-allowed'].join(' ')}
    >
      <Icon className={`h-10 w-10 ${iconClassName} mb-3`} aria-hidden />
      <span className="text-base font-semibold">{title}</span>
      <span className={subtitleClassName}>{subtitle}</span>
      {children}
    </button>
  );
}

export const DashboardScreen: React.FC = () => {
  const router = useRouter();
  const [deployStatus, setDeployStatus] = useState<'running' | 'success' | 'error'>('success');
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployLogs, setDeployLogs] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const syncEventSourceRef = useRef<EventSource | null>(null);
  const terminalStatusRef = useRef(false);
  const syncTerminalStatusRef = useRef(false);
  /** Evita onerror do EventSource sobrescrever success/error já recebidos via evento status. */
  const deployOutcomeRef = useRef<"pending" | "success" | "error">("pending");
  const syncOutcomeRef = useRef<"pending" | "success" | "error">("pending");
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const { deployInfo, loading: deployInfoLoading, error: deployInfoError, refetch: refetchDeployInfo } = useDeployInfo();

  const [syncStatus, setSyncStatus] = useState<'running' | 'success' | 'error'>('success');
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncLogs, setSyncLogs] = useState('');

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const closeSyncStream = () => {
    if (syncEventSourceRef.current) {
      syncEventSourceRef.current.close();
      syncEventSourceRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      closeStream();
      closeSyncStream();
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
  }, []);

  const handleDeployFirebase = async () => {
    if (deployStatus === 'running') return;

    closeStream();
    terminalStatusRef.current = false;
    deployOutcomeRef.current = "pending";

    setDeployLogs('');
    setDeployModalOpen(true);
    setDeployStatus('running');

    try {
      console.log('🔄 Iniciando conexão SSE...');
      const eventSource = new EventSource('/api/deploy/firebase/stream');
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return;
        console.log('📨 SSE message:', event.data);
        const data = event.data;
        setDeployLogs(prev => prev ? prev + '\n' + data : data);
      };

      eventSource.addEventListener('status', (e) => {
        if (!isMountedRef.current) {
          closeStream();
          return;
        }
        const statusData = (e as MessageEvent).data;
        console.log('🎯 SSE status event:', statusData);
        const ok = statusData === 'success';
        deployOutcomeRef.current = ok ? 'success' : 'error';
        terminalStatusRef.current = true;
        setDeployStatus(ok ? 'success' : 'error');

        if (ok) {
          if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
          refetchTimerRef.current = setTimeout(() => {
            refetchTimerRef.current = null;
            if (!isMountedRef.current) return;
            refetchDeployInfo();
          }, 2000);
        }

        closeStream();
      });

      eventSource.onerror = () => {
        const es = eventSource;
        window.setTimeout(() => {
          if (es !== eventSourceRef.current) return;
          if (!isMountedRef.current) {
            closeStream();
            return;
          }
          if (deployOutcomeRef.current !== 'pending') {
            closeStream();
            return;
          }
          if (terminalStatusRef.current) {
            closeStream();
            return;
          }
          console.error('❌ Erro no EventSource');
          setDeployLogs((prev) =>
            prev ? `${prev}\n❌ Erro na conexão de logs em tempo real` : '❌ Erro na conexão de logs em tempo real'
          );
          deployOutcomeRef.current = 'error';
          setDeployStatus('error');
          closeStream();
        }, 0);
      };
    } catch (error) {
      console.error('Erro ao iniciar deploy:', error);
      setDeployLogs('❌ Erro ao conectar com o servidor de deploy.');
      setDeployStatus('error');
      eventSourceRef.current = null;
    }
  };

  const handleSyncVpsJsons = async () => {
    if (syncStatus === 'running') return;

    closeSyncStream();
    syncTerminalStatusRef.current = false;
    syncOutcomeRef.current = 'pending';

    setSyncLogs('');
    setSyncModalOpen(true);
    setSyncStatus('running');

    try {
      const pre = await fetch('/api/local/sync-jsons/status');
      if (!pre.ok) {
        const body = (await pre.json().catch(() => null)) as { error?: string } | null;
        setSyncLogs(body?.error ?? `Recusado (${pre.status}). Esta ação só roda no admin local em modo desenvolvimento.`);
        syncOutcomeRef.current = 'error';
        setSyncStatus('error');
        return;
      }

      const eventSource = new EventSource('/api/local/sync-jsons/stream');
      syncEventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return;
        const data = event.data;
        setSyncLogs((prev) => (prev ? `${prev}\n${data}` : data));
      };

      eventSource.addEventListener('status', (e) => {
        if (!isMountedRef.current) {
          closeSyncStream();
          return;
        }
        const statusData = (e as MessageEvent).data;
        const ok = statusData === 'success';
        syncOutcomeRef.current = ok ? 'success' : 'error';
        syncTerminalStatusRef.current = true;
        setSyncStatus(ok ? 'success' : 'error');
        closeSyncStream();
      });

      eventSource.onerror = () => {
        const es = eventSource;
        window.setTimeout(() => {
          if (es !== syncEventSourceRef.current) return;
          if (!isMountedRef.current) {
            closeSyncStream();
            return;
          }
          if (syncOutcomeRef.current !== 'pending') {
            closeSyncStream();
            return;
          }
          if (syncTerminalStatusRef.current) {
            closeSyncStream();
            return;
          }
          setSyncLogs((prev) =>
            prev ? `${prev}\n❌ Erro na conexão de logs em tempo real` : '❌ Erro na conexão de logs em tempo real'
          );
          syncOutcomeRef.current = 'error';
          setSyncStatus('error');
          closeSyncStream();
        }, 0);
      };
    } catch {
      setSyncLogs('❌ Erro ao conectar com a rota de sincronização.');
      setSyncStatus('error');
      syncEventSourceRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Dashboard Admin BBB26</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Seção de Ferramentas e Execução */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Ferramentas e publicação</h2>
              <p className="text-gray-600">Automação, enquetes, banners e exportação</p>
            </div>

            <div className="mb-10">
              <div className="mb-4 text-center sm:text-left">
                <h3 className="text-lg font-semibold text-gray-900">Casa do Patrão</h3>
                <p className="text-sm text-gray-500 mt-0.5">Atalhos do módulo</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {CASA_DO_PATRAO_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <DashboardCard
                      key={tool.href}
                      onClick={() => router.push(tool.href)}
                      Icon={Icon}
                      iconClassName={tool.iconColor}
                      title={tool.title}
                      subtitle={tool.subtitle}
                      ringClassName={tool.ring}
                      className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
                    />
                  );
                })}
              </div>
            </div>

            {(['used', 'unused'] as const).map((section) => {
              const tools = DASHBOARD_TOOLS.filter((t) => (section === 'used' ? t.used : !t.used));
              const title = section === 'used' ? 'Ferramentas utilizadas' : 'Ferramentas não utilizadas';
              const description =
                section === 'used'
                  ? 'Fluxo principal do dia a dia'
                  : 'Diagnóstico, manutenção e itens secundários';

              return (
                <div key={section} className={section === 'unused' ? 'mt-10' : ''}>
                  <div className="mb-4 text-center sm:text-left">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {tools.map((tool) => {
                      const Icon = tool.icon;
                      const mutedBtn = tool.kind === 'link' && tool.muted;

                      if (tool.kind === 'deploy') {
                        return (
                          <DashboardCard
                            key={tool.title}
                            onClick={handleDeployFirebase}
                            disabled={deployStatus === 'running'}
                            Icon={Icon}
                            iconClassName={tool.iconColor}
                            title={tool.title}
                            subtitle={tool.subtitle}
                            subtitleClassName="text-sm text-gray-500 mt-1 text-center"
                            ringClassName={tool.ring}
                            className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
                          >
                            {deployInfo && !deployInfoLoading && !deployInfoError && (
                              <span className="text-xs text-gray-400 mt-2 text-center">
                                Último: {new Date(deployInfo.deployAt).toLocaleString('pt-BR')}
                              </span>
                            )}
                          </DashboardCard>
                        );
                      }

                      if (tool.kind === 'localVpsJsonSync') {
                        return (
                          <DashboardCard
                            key={tool.title}
                            onClick={handleSyncVpsJsons}
                            disabled={syncStatus === 'running'}
                            Icon={Icon}
                            iconClassName={tool.iconColor}
                            title={tool.title}
                            subtitle={tool.subtitle}
                            subtitleClassName="text-sm text-gray-600 mt-1 text-center"
                            ringClassName={tool.ring}
                            className="border-dashed border-sky-300 text-gray-800 bg-sky-50/60 hover:bg-sky-50 hover:shadow-lg"
                          >
                            <span className="text-xs text-sky-800/90 mt-1 text-center font-medium">
                              Apenas neste PC (dev)
                            </span>
                          </DashboardCard>
                        );
                      }

                      return (
                        <DashboardCard
                          key={tool.href}
                          onClick={() => router.push(tool.href)}
                          Icon={Icon}
                          iconClassName={tool.iconColor}
                          title={tool.title}
                          subtitle={tool.subtitle}
                          ringClassName={tool.ring}
                          className={
                            mutedBtn
                              ? 'border-dashed border-gray-400 text-gray-600 bg-gray-50 hover:bg-gray-100 hover:shadow-lg'
                              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg'
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seção de Edição de Dados */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Edição de Dados</h2>
              <p className="text-gray-600">Selecione uma das opções abaixo para editar os dados do BBB26</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                onClick={() => router.push('/bbb26')}
                Icon={CalendarDaysIcon}
                iconClassName="text-indigo-600"
                title="BBB26"
                subtitle="bbb26.json"
                ringClassName="focus:ring-indigo-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />

              <DashboardCard
                onClick={() => router.push('/participants-status')}
                Icon={UsersIcon}
                iconClassName="text-green-600"
                title="Participants status"
                subtitle="participants-status.json"
                ringClassName="focus:ring-green-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />

              <DashboardCard
                onClick={() => router.push('/followers')}
                Icon={UsersIcon}
                iconClassName="text-sky-600"
                title="Followers"
                subtitle="followers-status.json"
                ringClassName="focus:ring-sky-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />

              <DashboardCard
                onClick={() => router.push('/week')}
                Icon={CalendarDaysIcon}
                iconClassName="text-amber-600"
                title="Semana"
                subtitle="Programação da semana"
                ringClassName="focus:ring-amber-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />

              <DashboardCard
                onClick={() => router.push('/participants')}
                Icon={UsersIcon}
                iconClassName="text-teal-600"
                title="Participantes"
                subtitle="Lista / edição"
                ringClassName="focus:ring-teal-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />

              <DashboardCard
                onClick={() => router.push('/history')}
                Icon={ClockIcon}
                iconClassName="text-gray-600"
                title="Histórico"
                subtitle="Histórico de edições"
                ringClassName="focus:ring-gray-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />

              <DashboardCard
                onClick={() => router.push('/export')}
                Icon={ArrowDownTrayIcon}
                iconClassName="text-cyan-600"
                title="Exportar Dados"
                subtitle="Pacotes ZIP / dados"
                ringClassName="focus:ring-cyan-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />

              <DashboardCard
                onClick={() => router.push('/publish')}
                Icon={RocketLaunchIcon}
                iconClassName="text-emerald-600"
                title="Publicar Arquivos"
                subtitle="Fluxo de publicação"
                ringClassName="focus:ring-emerald-500"
                className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg"
              />
            </div>
          </div>

          {/* Seção de Informações do Deploy */}
          <div className="mt-12">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Status do Deploy</h3>
              <p className="text-gray-600">Informações da última publicação</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {deployInfoLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  <span className="ml-3 text-gray-600">Carregando informações...</span>
                </div>
              ) : deployInfoError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">❌ Erro ao carregar informações</div>
                  <div className="text-sm text-gray-500">{deployInfoError}</div>
                </div>
              ) : deployInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Último Deploy:</span>
                    </div>
                    <span className="text-sm text-gray-900 font-mono">{deployInfo.lastDeploy}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CloudArrowUpIcon className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Versão:</span>
                    </div>
                    <span className="text-sm text-gray-900 font-mono">{deployInfo.version}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <GlobeAltIcon className="h-5 w-5 text-purple-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">URL:</span>
                    </div>
                    <a
                      href={deployInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline font-mono"
                    >
                      {deployInfo.url}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500">ℹ️ Nenhuma informação de deploy encontrada</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Logs do Deploy */}
      <ModalLogs
        isOpen={deployModalOpen}
        title="Deploy Firebase Hosting (bbb-26)"
        logs={deployLogs}
        status={deployStatus}
        onClose={() => {
          if (deployStatus === 'running') return;
          setDeployModalOpen(false);
        }}
      />

      <ModalLogs
        variant="localDownload"
        isOpen={syncModalOpen}
        title="Baixar JSONs do VPS (uso local)"
        logs={syncLogs}
        status={syncStatus}
        onClose={() => {
          if (syncStatus === 'running') return;
          setSyncModalOpen(false);
        }}
      />
    </div>
  );
};
