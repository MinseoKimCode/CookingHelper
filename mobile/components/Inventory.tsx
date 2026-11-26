import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRecipeBrowser } from '../state/AppProvider';
import { Button, Field } from './ui';
import { colors, ui } from '../theme';
import { daysUntil } from '../recipeTools';

function InventoryContent() {
  const app = useRecipeBrowser();
  const stock = app.settings.stock || [];
  const [name, select] = useState('');
  const [qty, quantity] = useState('');
  const [unit, setUnit] = useState('');
  const [date, expires] = useState('');
  const [error, setError] = useState('');
  function open(value: string) {
    const item = stock.find((row) => row.name === value);
    select(value);
    quantity(item ? String(item.quantity) : '');
    setUnit(item?.unit || '개');
    expires(item?.expires || '');
    setError('');
  }
  function save() {
    const day = date && new Date(date + 'T12:00:00Z');
    if (
      !/^\d+(\.\d{1,3})?$/.test(qty) ||
      Number(qty) <= 0 ||
      Number(qty) > 100000 ||
      !unit.trim() ||
      (day &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(day.getTime()) ||
          day.toISOString().slice(0, 10) !== date))
    ) {
      setError('양수인 수량, 단위와 올바른 날짜를 입력해주세요.');
      return;
    }
    app.updateSettings({
      stock: [
        ...stock.filter((row) => row.name !== name),
        { name, quantity: Number(qty), unit: unit.trim(), expires: date },
      ],
    });
    select('');
  }
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>재고와 소비기한</Text>
      <View style={ui.row}>
        {app.settings.ingredients.map((value) => {
          const row = stock.find((item) => item.name === value);
          return (
            <Button key={value} small secondary onPress={() => open(value)}>
              {value + ' · ' + (row ? row.quantity + row.unit : '수량 등록')}
            </Button>
          );
        })}
      </View>
      {app.settings.ingredients.includes(name) && (
        <>
          <Text style={ui.label}>{name} 재고 수정</Text>
          <Field label="보유 수량" keyboardType="decimal-pad" value={qty} onChangeText={quantity} />
          <Field label="단위" maxLength={12} value={unit} onChangeText={setUnit} />
          <Field
            label="소비기한 (선택)"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={expires}
          />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <View style={ui.row}>
            <Button onPress={save}>재고 저장</Button>
            <Button secondary onPress={() => select('')}>
              닫기
            </Button>
          </View>
        </>
      )}
      {stock
        .filter((item) => item.expires)
        .sort((a, b) => a.expires.localeCompare(b.expires))
        .map((item) => (
          <View key={item.name} style={ui.row}>
            <Text style={ui.text}>
              {item.expires} · {item.name}
            </Text>
            {item.expires < today ? (
              <Text style={ui.error}>소비기한 지남</Text>
            ) : (
              <>
                <Text
                  style={{
                    fontWeight: '700',
                    color: daysUntil(item.expires, today) <= 3 ? colors.danger : colors.green,
                  }}
                >
                  {daysUntil(item.expires, today) === 0
                    ? 'D-DAY'
                    : `D-${daysUntil(item.expires, today)}`}
                </Text>{' '}
                <Button
                  small
                  ghost
                  disabled={app.searching}
                  onPress={() => void app.recommend(false, item.name)}
                >
                  이 재료 먼저 쓰기
                </Button>
              </>
            )}
          </View>
        ))}
      {!!app.settings.undoStock?.length && (
        <Button small ghost onPress={app.undoConsumption}>
          마지막 조리 차감 되돌리기
        </Button>
      )}
    </View>
  );
}

export const Inventory = React.memo(InventoryContent);
