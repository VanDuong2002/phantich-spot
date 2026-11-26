import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SettingsDrawer } from './SettingsDrawer';
import { createDefaultSettings } from '../settings/presets';
import { exportSettingsJson } from '../settings/storage';

afterEach(() => {
  cleanup();
});

describe('SettingsDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <SettingsDrawer
        open={false}
        settings={createDefaultSettings()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('switches active mode when user selects another preset', () => {
    const onChange = vi.fn();
    render(
      <SettingsDrawer
        open={true}
        settings={createDefaultSettings()}
        onChange={onChange}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('An toàn'));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].activeModeId).toBe('conservative');
  });

  it('clones active mode as an editable custom mode and allows deleting custom modes only', () => {
    const onChange = vi.fn();
    const initial = createDefaultSettings();
    const { rerender } = render(
      <SettingsDrawer
        open={true}
        settings={initial}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    // Built-in mode should not show delete button
    expect(screen.queryByRole('button', { name: /Xóa chế độ/i })).toBeNull();

    // Clone active mode
    fireEvent.click(screen.getByRole('button', { name: /Nhân bản thành chế độ mới/i }));
    expect(onChange).toHaveBeenCalledTimes(1);

    const clonedSettings = onChange.mock.calls[0][0];
    expect(clonedSettings.modes.length).toBe(initial.modes.length + 1);
    const clonedMode = clonedSettings.modes.find(
      (m: { id: string }) => m.id === clonedSettings.activeModeId,
    );
    expect(clonedMode).toBeDefined();
    expect(clonedMode.isBuiltIn).toBe(false);

    // Re-render with cloned settings active
    onChange.mockClear();
    rerender(
      <SettingsDrawer
        open={true}
        settings={clonedSettings}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    // Rename custom mode
    const nameInput = screen.getByLabelText('Tên chế độ');
    fireEvent.change(nameInput, { target: { value: 'Săn sóng 4H' } });
    expect(onChange).toHaveBeenCalled();
    const renamedSettings = onChange.mock.calls[0][0];
    const renamedMode = renamedSettings.modes.find(
      (m: { id: string }) => m.id === renamedSettings.activeModeId,
    );
    expect(renamedMode.name).toBe('Săn sóng 4H');

    // Delete custom mode
    onChange.mockClear();
    const deleteBtn = screen.getByRole('button', { name: /Xóa chế độ/i });
    fireEvent.click(deleteBtn);
    expect(onChange).toHaveBeenCalledTimes(1);
    const afterDelete = onChange.mock.calls[0][0];
    expect(afterDelete.modes.length).toBe(initial.modes.length);
  });

  it('edits params and guards against invalid/zero/negative numeric values', () => {
    const onChange = vi.fn();
    render(
      <SettingsDrawer
        open={true}
        settings={createDefaultSettings()}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    const emaFastInput = screen.getByLabelText('EMA nhanh');
    // Invalid zero or negative values should be rejected (not passed to onChange)
    fireEvent.change(emaFastInput, { target: { value: '0' } });
    fireEvent.change(emaFastInput, { target: { value: '-10' } });
    expect(onChange).not.toHaveBeenCalled();

    // Valid positive period should update settings
    fireEvent.change(emaFastInput, { target: { value: '13' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedMode = onChange.mock.calls[0][0].modes.find(
      (m: { id: string }) => m.id === 'balanced',
    );
    expect(updatedMode.params.emaFast).toBe(13);

    // Toggle requireHigherTfNotBearish
    onChange.mockClear();
    const toggle = screen.getByLabelText(/Chặn MUA ngược khung lớn/i);
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
    const toggledMode = onChange.mock.calls[0][0].modes.find(
      (m: { id: string }) => m.id === 'balanced',
    );
    expect(toggledMode.requireHigherTfNotBearish).toBe(false);
  });

  it('shows Vietnamese error message on invalid JSON import and applies valid JSON import', async () => {
    const onChange = vi.fn();
    render(
      <SettingsDrawer
        open={true}
        settings={createDefaultSettings()}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    // Switch to Tab 2
    fireEvent.click(screen.getByRole('tab', { name: /Dữ liệu & Mở rộng/i }));

    // Extension slot for v2 scanner should be visible
    expect(screen.getByText(/Máy quét thị trường gợi ý coin nên mua/i)).toBeTruthy();

    const fileInput = screen.getByLabelText(/Nhập cấu hình \(JSON\)/i);

    // Upload invalid JSON
    const badFile = new File(['{ invalid json'], 'bad.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/không đúng định dạng/i);
    });
    expect(onChange).not.toHaveBeenCalled();

    // Upload valid JSON
    const customSettings = createDefaultSettings();
    customSettings.activeModeId = 'aggressive';
    customSettings.extensions = { marketScannerV2: { enabled: false } };
    const goodFile = new File([exportSettingsJson(customSettings)], 'good.json', {
      type: 'application/json',
    });
    fireEvent.change(fileInput, { target: { files: [goodFile] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    expect(onChange.mock.calls[0][0].activeModeId).toBe('aggressive');
    expect(onChange.mock.calls[0][0].extensions).toEqual({
      marketScannerV2: { enabled: false },
    });
  });

  it('resets settings to defaults via createDefaultSettings', () => {
    const onChange = vi.fn();
    const modified = createDefaultSettings();
    modified.activeModeId = 'aggressive';

    render(
      <SettingsDrawer
        open={true}
        settings={modified}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Dữ liệu & Mở rộng/i }));
    fireEvent.click(screen.getByRole('button', { name: /Khôi phục mặc định/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].activeModeId).toBe('balanced');
    expect(onChange.mock.calls[0][0].modes.length).toBe(3);
  });

  it('allows intermediate keystrokes in NumericField and recovers on blur when invalid', () => {
    const onChange = vi.fn();
    render(
      <SettingsDrawer
        open={true}
        settings={createDefaultSettings()}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    const rsiOverboughtInput = screen.getByLabelText('RSI quá mua') as HTMLInputElement;
    expect(rsiOverboughtInput.value).toBe('70');

    // Clear input -> should stay empty in DOM without committing invalid value
    fireEvent.change(rsiOverboughtInput, { target: { value: '' } });
    expect(rsiOverboughtInput.value).toBe('');
    expect(onChange).not.toHaveBeenCalled();

    // Type first digit "7" (below min 51) -> should stay "7" in DOM without committing
    fireEvent.change(rsiOverboughtInput, { target: { value: '7' } });
    expect(rsiOverboughtInput.value).toBe('7');
    expect(onChange).not.toHaveBeenCalled();

    // Blur while invalid -> recovers to last valid value "70"
    fireEvent.blur(rsiOverboughtInput);
    expect(rsiOverboughtInput.value).toBe('70');

    // Now type "7" then "75" -> commits 75
    fireEvent.change(rsiOverboughtInput, { target: { value: '7' } });
    expect(rsiOverboughtInput.value).toBe('7');
    fireEvent.change(rsiOverboughtInput, { target: { value: '75' } });
    expect(rsiOverboughtInput.value).toBe('75');
    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedMode = onChange.mock.calls[0][0].modes.find(
      (m: { id: string }) => m.id === 'balanced',
    );
    expect(updatedMode.params.rsiOverbought).toBe(75);
  });

  it('allows clearing mode name to retype and restores previous name on blur if left blank', () => {
    const onChange = vi.fn();
    render(
      <SettingsDrawer
        open={true}
        settings={createDefaultSettings()}
        onChange={onChange}
        onClose={() => {}}
      />,
    );

    const nameInput = screen.getByLabelText('Tên chế độ') as HTMLInputElement;
    expect(nameInput.value).toBe('Cân bằng');

    // Clear name -> stays empty in DOM, does not commit blank
    fireEvent.change(nameInput, { target: { value: '' } });
    expect(nameInput.value).toBe('');
    expect(onChange).not.toHaveBeenCalled();

    // Blur while blank -> restores previous valid name
    fireEvent.blur(nameInput);
    expect(nameInput.value).toBe('Cân bằng');

    // Clear and type a new name -> commits trimmed name
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.change(nameInput, { target: { value: 'Chiến lược Spot 4H' } });
    expect(nameInput.value).toBe('Chiến lược Spot 4H');
    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedMode = onChange.mock.calls[0][0].modes.find(
      (m: { id: string }) => m.id === 'balanced',
    );
    expect(updatedMode.name).toBe('Chiến lược Spot 4H');
  });
});
