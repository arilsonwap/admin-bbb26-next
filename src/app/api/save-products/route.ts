import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, readdir, unlink, mkdir, stat, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { ProductsJsonPayloadSchema } from '../../../models/types';

// Forçar execução dinâmica e desabilitar cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🔒 Sistema de lock baseado em arquivo para evitar race conditions
class FileLock {
  private lockFile: string;

  constructor(lockFile: string) {
    this.lockFile = lockFile;
  }

  async acquire(timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Tentar criar arquivo de lock exclusivo
        await writeFile(this.lockFile, `${Date.now()}`, { flag: 'wx' });
        return true;
      } catch {
        // Lock já existe, aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return false; // Timeout
  }

  async release(): Promise<void> {
    try {
      await unlink(this.lockFile);
    } catch {
      // Lock já foi removido ou não existe
    }
  }
}

// 🧹 Função para limpar backups antigos (mantém apenas os 30 mais recentes)
async function cleanupOldBackups(backupDir: string): Promise<void> {
  try {
    const files = await readdir(backupDir);
    const backupFiles = files.filter(file =>
      file.startsWith('products-status-backup-') && file.endsWith('.json')
    );

    // Obter stats de todos os arquivos de forma assíncrona
    const filesWithStats = await Promise.all(
      backupFiles.map(async (file) => {
        const filePath = join(backupDir, file);
        try {
          const stats = await stat(filePath);
          return {
            name: file,
            path: filePath,
            mtime: stats.mtime.getTime()
          };
        } catch (error) {
          console.warn(`⚠️ Erro ao obter stats de ${file}:`, error);
          return null;
        }
      })
    );

    // Filtrar arquivos válidos e ordenar por data modificada (mais recente primeiro)
    const validFiles = filesWithStats.filter(file => file !== null);
    validFiles.sort((a, b) => b!.mtime - a!.mtime);

    if (validFiles.length > 30) {
      const filesToDelete = validFiles.slice(30); // Pegar do 31º em diante
      console.log(`🗑️ Removendo ${filesToDelete.length} backups antigos`);

      // Deletar arquivos em paralelo para melhor performance
      await Promise.all(
        filesToDelete.map(async (file) => {
          try {
            await unlink(file!.path);
            console.log(`  ❌ Deletado: ${file!.name}`);
          } catch (error) {
            console.warn(`⚠️ Erro ao deletar ${file!.name}:`, error);
          }
        })
      );
    }
  } catch (error) {
    console.warn('⚠️ Erro ao limpar backups antigos:', error);
    // Não falha a operação principal por causa da limpeza
  }
}

export async function POST(request: NextRequest) {
  // 🔐 Autenticação básica via API Key
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    return NextResponse.json({
      error: 'Acesso negado',
      message: 'API Key inválida ou ausente'
    }, { status: 401 });
  }

  const lock = new FileLock(join(process.cwd(), 'products-status.lock'));

  try {
    // 🔒 Adquirir lock para evitar race conditions
    const lockAcquired = await lock.acquire(5000);
    if (!lockAcquired) {
      return NextResponse.json({
        error: 'Servidor ocupado',
        message: 'Outro salvamento está em andamento. Tente novamente em alguns segundos.'
      }, { status: 503 });
    }

    const { data, expectedVersion } = await request.json();

    if (!data) {
      return NextResponse.json({ error: 'Dados não fornecidos' }, { status: 400 });
    }

    // 🔍 Validar schema completo com Zod
    const validationResult = ProductsJsonPayloadSchema.safeParse(data);
    if (!validationResult.success) {
      console.error('Erro de validação do schema:', validationResult.error);
      return NextResponse.json({
        error: 'Dados inválidos',
        details: validationResult.error.format()
      }, { status: 400 });
    }

    // ✅ Dados validados
    const validatedData = validationResult.data;

    // 📁 Caminhos dos arquivos e diretórios
    const hostingDir = join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    const hostingPath = join(hostingDir, 'products-status.json');
    const rootPath = join(process.cwd(), 'products-status.json');

    // 🔒 Controle de concorrência: verificar versão esperada vs atual
    if (expectedVersion !== undefined) {
      // Pequeno delay para garantir que escritas pendentes sejam concluídas
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        // Tentar ler versão atual do arquivo
        const currentFileContent = await readFile(hostingPath, 'utf8');
        const currentFileData = JSON.parse(currentFileContent);

        console.log('🔍 Validação de versão:', {
          expectedVersion,
          currentVersion: currentFileData.version,
          dataVersion: validatedData.version,
          match: currentFileData.version === expectedVersion,
          timestamp: new Date().toISOString()
        });

        if (currentFileData.version !== expectedVersion) {
          console.log('❌ Conflito de versão detectado no backend');
          return NextResponse.json({
            error: 'Conflito de versão',
            message: 'O arquivo foi modificado por outro usuário desde sua última leitura.',
            currentVersion: currentFileData.version,
            expectedVersion: expectedVersion
          }, { status: 409 });
        }
      } catch (readError) {
        // Se não conseguir ler (arquivo não existe), continua normalmente
        console.log('Arquivo não existe ainda, pulando validação de concorrência');
      }
    }

    // 🔧 Garantir que os diretórios existam
    try {
      await access(hostingDir);
    } catch {
      await mkdir(hostingDir, { recursive: true });
    }

    const backupDir = join(process.cwd(), 'tools', 'bbb-hosting', 'backups');
    try {
      await access(backupDir);
    } catch {
      await mkdir(backupDir, { recursive: true });
    }

    // Formato: products-status-backup-2026-03-09T14-30-25-123Z.json
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupFilename = `products-status-backup-${timestamp}.json`;
    const backupPath = join(backupDir, backupFilename);

    // Criar backup do arquivo atual se existir
    try {
      await access(hostingPath);
      try {
        const currentContent = await readFile(hostingPath, 'utf8');
        await writeFile(backupPath, currentContent, 'utf8');
        console.log(`📦 Backup criado: ${backupFilename}`);

        // 🧹 Limpeza automática de backups antigos (manter apenas os 30 mais recentes)
        await cleanupOldBackups(backupDir);
      } catch (backupError) {
        console.warn('⚠️ Falha ao criar backup, mas continuando com salvamento:', backupError);
        // Não falha o salvamento por causa do backup
      }
    } catch (accessError) {
      // Arquivo não existe, continua sem backup
      console.log('Arquivo ainda não existe, pulando backup');
    }

    // 💾 Salvar dados validados (arquivo principal primeiro, depois cópia)
    const jsonContent = JSON.stringify(validatedData, null, 2);

    // Estratégia: hostingPath é a fonte da verdade, rootPath é cópia derivada
    let primarySaveSuccess = false;

    try {
      // 1. Salvar arquivo principal (fonte da verdade)
      await writeFile(hostingPath, jsonContent, 'utf8');
      primarySaveSuccess = true;

      // 2. Salvar cópia na raiz para compatibilidade
      await writeFile(rootPath, jsonContent, 'utf8');

      console.log('✅ Arquivos salvos com sucesso (primário + cópia)');
    } catch (saveError) {
      // Se falhou ao salvar a cópia, mas o principal conseguiu, ainda é sucesso
      if (primarySaveSuccess) {
        console.warn('⚠️ Arquivo principal salvo, mas cópia falhou:', saveError);
      } else {
        throw saveError; // Falha crítica no arquivo principal
      }
    }

    // 🔍 Validação de integridade pós-gravação (comparação completa do conteúdo)
    try {
      const savedContent = await readFile(hostingPath, 'utf8');

      // Comparar conteúdo completo para detectar qualquer corrupção
      if (savedContent !== jsonContent) {
        console.error('❌ Falha na validação de integridade pós-gravação - conteúdo divergiu');

        // Tentar restaurar do backup se existir
        try {
          await access(backupPath);
          const backupContent = await readFile(backupPath, 'utf8');
          await writeFile(hostingPath, backupContent, 'utf8');
          await writeFile(rootPath, backupContent, 'utf8');
          throw new Error('Dados corrompidos detectados. Backup restaurado automaticamente.');
        } catch {
          throw new Error('Dados corrompidos detectados. Backup não disponível.');
        }
      }
      console.log('✅ Integridade dos dados verificada com sucesso');
    } catch (integrityError) {
      console.error('Erro na validação de integridade:', integrityError);
      throw integrityError;
    }

    // Verificar se backup foi criado
    let backupCreated = false;
    try {
      await access(backupPath);
      backupCreated = true;
    } catch {
      // Backup não foi criado
    }

    return NextResponse.json({
      success: true,
      message: 'Arquivo products-status.json atualizado com sucesso',
      backup: backupCreated ? backupFilename : null,
      version: validatedData.version,
      data: validatedData // Retornar dados salvos para consistência do frontend
    });

  } catch (error) {
    console.error('Erro ao salvar products-status.json:', error);
    return NextResponse.json({
      error: 'Erro ao salvar arquivo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  } finally {
    // 🔓 Sempre liberar o lock
    await lock.release();
  }
}