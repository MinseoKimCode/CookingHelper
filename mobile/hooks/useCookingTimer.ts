import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { pendingTimerAlert } from '../timerAlert';

export function CookingAwake() {
  useKeepAwake('hankki-cooking', { suppressDeactivateWarnings: true });
  return null;
}

export function useCookingTimer({
  minutes,
  step,
  active,
  title,
  notify,
}: {
  minutes: number;
  step: number;
  active: boolean;
  title: string;
  notify: (message: string) => void;
}) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [alertStatus, setAlertStatus] = useState('');
  const deadline = useRef(0);
  const notice = useRef(notify);
  notice.current = notify;
  useEffect(() => {
    setRunning(false);
    setRemaining(minutes * 60);
    setAlertStatus('');
  }, [step, minutes, active]);
  useEffect(() => {
    if (!running || !active) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (!left) {
        setRunning(false);
        notice.current('타이머가 끝났어요. 음식의 익힘 상태를 확인해주세요.');
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [running, active]);
  useEffect(() => {
    if (!running || !active) return;
    if (Platform.OS === 'web') {
      setAlertStatus('웹에서는 이 화면이 열려 있는 동안 타이머를 확인해주세요.');
      return;
    }
    const task = pendingTimerAlert(
      async (cancelled) => {
        // Load only on native platforms; the web bundle never initializes native notifications.
        const notifications = await import('expo-notifications');
        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        if (Platform.OS === 'android')
          await notifications.setNotificationChannelAsync('cooking', {
            name: '조리 타이머',
            importance: notifications.AndroidImportance.HIGH,
            sound: 'default',
          });
        let permission = await notifications.getPermissionsAsync();
        if (cancelled()) return;
        if (!permission.granted && permission.canAskAgain)
          permission = await notifications.requestPermissionsAsync();
        if (cancelled()) return;
        if (!permission.granted) {
          setAlertStatus('알림 권한이 꺼져 있어요. 타이머는 이 화면에서 계속 동작해요.');
          return;
        }
        if (deadline.current <= Date.now()) return;
        return notifications.scheduleNotificationAsync({
          content: {
            title: '조리 시간이 됐어요',
            body: `${title} · 음식의 익힘 상태를 확인해주세요.`,
            sound: 'default',
          },
          trigger: {
            type: notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(deadline.current),
            channelId: 'cooking',
          },
        });
      },
      async (id) => {
        const notifications = await import('expo-notifications');
        await notifications.cancelScheduledNotificationAsync(id);
      },
      () =>
        setAlertStatus('타이머 종료 알림을 예약했어요. 기기 설정에 따라 알림이 지연될 수 있어요.'),
      () => setAlertStatus('알림을 예약하지 못했어요. 이 화면의 타이머를 확인해주세요.'),
    );
    return () => task.stop();
  }, [running, active, title, step]);
  function stopTimer() {
    if (running) setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    setRunning(false);
  }
  function toggleTimer() {
    if (running) stopTimer();
    else {
      const seconds = remaining || minutes * 60;
      if (seconds <= 0) return;
      deadline.current = Date.now() + seconds * 1000;
      setRemaining(seconds);
      setRunning(true);
    }
  }
  return { remaining, running, alertStatus, toggleTimer, stopTimer };
}
