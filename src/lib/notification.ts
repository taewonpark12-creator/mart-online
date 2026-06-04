// 주문 알림 관리 유틸리티
import { useState, useEffect } from "react";

export interface NotificationConfig {
  interval: number; // 반복 간격 (ms)
  soundEnabled: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
  interval: 3000, // 3초
  soundEnabled: true,
};

class OrderNotificationManager {
  private audio: HTMLAudioElement | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isPlaying: boolean = false;
  private pendingOrderCount: number = 0;
  private config: NotificationConfig = DEFAULT_CONFIG;
  private onStatusChange?: (playing: boolean) => void;
  private userInteracted: boolean = false;
  private onAutoplayBlocked?: () => void;

  constructor() {
    // 생성자에서 Audio 객체 생성하지 않음 (SSR 오류 방지)

    // 사용자 상호작용 감지
    if (typeof window !== 'undefined') {
      const enableAudio = () => {
        this.userInteracted = true;
        // 이벤트 리스너 제거 (한 번만 실행)
        document.removeEventListener('click', enableAudio);
        document.removeEventListener('keydown', enableAudio);
        document.removeEventListener('touchstart', enableAudio);
      };

      document.addEventListener('click', enableAudio);
      document.addEventListener('keydown', enableAudio);
      document.addEventListener('touchstart', enableAudio);
    }
  }

  // Lazy initialization: 브라우저 환경에서만 Audio 객체 생성
  private getAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.audio) {
      this.audio = new Audio('/notification.mp3');
      this.audio.loop = false;

      // 오디오 로드 오류 처리
      this.audio.addEventListener('error', () => {
        console.error('알림음 파일 로드 실패. 파일이 존재하는지 확인해주세요: /notification.mp3');
        this.config.soundEnabled = false;
      });
    }

    return this.audio;
  }

  setConfig(config: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  setStatusChangeCallback(callback: (playing: boolean) => void) {
    this.onStatusChange = callback;
  }

  setAutoplayBlockedCallback(callback: () => void) {
    this.onAutoplayBlocked = callback;
  }

  private playSound() {
    if (!this.config.soundEnabled || typeof window === 'undefined') return;

    const audio = this.getAudio();
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch((error) => {
      if (error.name === 'NotAllowedError') {
        console.warn('자동 재생이 차단됨. 사용자 상호작용 필요.');
        this.onAutoplayBlocked?.();
      } else if (error.name === 'NotSupportedError') {
        console.error('알림음 파일을 찾을 수 없거나 지원되지 않는 형식입니다.');
        this.config.soundEnabled = false;
      } else {
        console.error('알림음 재생 실패:', error);
      }
    });
  }

  private startTimer() {
    this.stopTimer(); // 기존 타이머 정리

    if (!this.config.soundEnabled || this.pendingOrderCount === 0) {
      this.stop();
      return;
    }

    // 즉시 첫 번째 재생
    this.playSound();
    this.isPlaying = true;
    this.onStatusChange?.(true);

    // 반복 재생 타이머
    this.timer = setInterval(() => {
      if (this.pendingOrderCount > 0) {
        this.playSound();
      } else {
        this.stop();
      }
    }, this.config.interval);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  start(pendingOrderCount: number) {
    this.pendingOrderCount = pendingOrderCount;
    if (pendingOrderCount > 0) {
      this.startTimer();
    }
  }

  stop() {
    this.stopTimer();
    this.isPlaying = false;
    this.pendingOrderCount = 0;
    this.onStatusChange?.(false);
  }

  updatePendingCount(count: number) {
    this.pendingOrderCount = count;
    if (count === 0) {
      this.stop();
    } else if (!this.isPlaying) {
      this.start(count);
    }
  }

  isActive(): boolean {
    return this.isPlaying;
  }

  getPendingCount(): number {
    return this.pendingOrderCount;
  }

  // 수동으로 오디오 활성화 (사용자 상호작용 후 호출)
  enableAudio() {
    this.userInteracted = true;
  }

  // 리소스 정리
  cleanup() {
    this.stop();
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
  }
}

// 싱글톤 인스턴스
export const notificationManager = new OrderNotificationManager();

// React Hook
export function useOrderNotification() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    notificationManager.setStatusChangeCallback((playing) => {
      setIsPlaying(playing);
      setPendingCount(notificationManager.getPendingCount());
    });

    notificationManager.setAutoplayBlockedCallback(() => {
      setAutoplayBlocked(true);
    });

    return () => {
      notificationManager.cleanup();
    };
  }, []);

  const startNotification = (count: number) => {
    notificationManager.start(count);
  };

  const stopNotification = () => {
    notificationManager.stop();
  };

  const updatePendingCount = (count: number) => {
    notificationManager.updatePendingCount(count);
  };

  const setNotificationConfig = (config: Partial<NotificationConfig>) => {
    notificationManager.setConfig(config);
  };

  const enableAudio = () => {
    notificationManager.enableAudio();
    setAutoplayBlocked(false);
  };

  return {
    isPlaying,
    pendingCount,
    autoplayBlocked,
    startNotification,
    stopNotification,
    updatePendingCount,
    setNotificationConfig,
    enableAudio,
    isActive: () => notificationManager.isActive(),
    getPendingCount: () => notificationManager.getPendingCount(),
  };
}
