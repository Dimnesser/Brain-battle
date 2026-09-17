import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react';
import { APP_NAME } from '@nexus/shared';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Перехватывает падения рендера.
 * Внутри Telegram белый экран без объяснений выглядит как сломанное приложение,
 * поэтому показываем понятный экран и даём перезагрузиться.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // В production сюда стоит подключить внешний сборщик ошибок
    console.error('[nexus] сбой интерфейса:', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🛠</div>
        <h1 className="font-display text-xl font-bold">{APP_NAME} временно недоступен</h1>
        <p className="max-w-[300px] text-[13px] text-text-muted">
          Интерфейс столкнулся с ошибкой. Перезагрузите приложение — данные и баланс в безопасности.
        </p>
        <button
          onClick={this.reset}
          className="press rounded-2xl bg-gradient-to-r from-primary to-secondary px-6 py-3 text-[15px] font-semibold text-white shadow-glow-sm"
        >
          Перезагрузить
        </button>
        {import.meta.env.DEV && (
          <pre className="mt-2 max-w-full overflow-x-auto rounded-xl bg-black/40 p-3 text-left text-[10px] text-danger">
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}

/** Обёртка для точечного использования внутри разметки. */
export function withErrorBoundary(children: ReactNode): ReactElement {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
