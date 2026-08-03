export interface EngineStatus {
  installed: boolean;
  engines: {
    pdflatex: string | null;
    xelatex: string | null;
    tlmgr: string | null;
    miktex: string | null;
    mpm: string | null;
    packageManager: "tlmgr" | "miktex" | null;
  };
}

export interface CompileDiagnostic {
  line: number | null;
  severity: "error" | "warning";
  message: string;
  rawMessage: string;
}

export interface CompileResult {
  success: boolean;
  pdf?: Uint8Array;
  log: string;
  errors: string[];
  diagnostics: CompileDiagnostic[];
  missingEngine?: boolean;
  missingPackage?: string | null;
  cancelled?: boolean;
}

export interface PackageInfo {
  name: string;
  sizeKB: number | null;
  shortdesc: string;
  installed?: boolean;
  approximate?: boolean;
  example: string;
  xelatexOnly: boolean;
}

export interface PackageListResult {
  source: "tlmgr" | "miktex" | "bundled";
  packageManager: "tlmgr" | "miktex" | null;
  total: number;
  packages: PackageInfo[];
}

export interface ProgressState {
  completedLessons: string[];
  setupDismissed: boolean;
}

export interface FreeModeFiles {
  files: Record<string, string>;
  lastActiveFile: string;
}

export interface PdfSaveResult {
  success: boolean;
  cancelled?: boolean;
  filePath?: string;
  message?: string;
}

export interface WindowApi {
  engine: {
    status: () => Promise<EngineStatus>;
    openInstallPage: (target: "miktex" | "tinytex") => Promise<boolean>;
  };
  compile: (payload: {
    jobKey: string;
    files: Record<string, string>;
    mainFileName: string;
    engine?: "pdflatex" | "xelatex";
  }) => Promise<CompileResult>;
  packages: {
    list: (query: string) => Promise<PackageListResult>;
    install: (name: string) => Promise<{ success: boolean; message: string }>;
    uninstall: (name: string) => Promise<{ success: boolean; message: string }>;
    onInstallProgress: (cb: (data: { name: string; chunk: string }) => void) => () => void;
  };
  pdf: {
    save: (pdf: Uint8Array, suggestedName: string) => Promise<PdfSaveResult>;
    open: (filePath: string) => Promise<string>;
    reveal: (filePath: string) => Promise<boolean>;
  };
  progress: {
    get: () => Promise<ProgressState>;
    completeLesson: (lessonId: string) => Promise<string[]>;
    dismissSetup: (value: boolean) => Promise<void>;
  };
  freeMode: {
    getFiles: () => Promise<FreeModeFiles>;
    saveFile: (relPath: string, content: string) => Promise<void>;
    deleteFile: (relPath: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    api: WindowApi;
  }
}
