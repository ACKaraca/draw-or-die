import { fireEvent, render, screen } from '@testing-library/react';
import { UploadStep } from './UploadStep';

const baseFormData = {
  topic: 'Brutalist Library',
  site: 'Istanbul',
  concept: 'Light wells and circulation',
  defense: 'Main axis and circulation decisions are intentional.',
  category: 'Pafta Tasarımı',
  harshness: 3,
  analysisLength: 'SHORT',
  singlePersonaId: 'constructive',
  multiPersonaIds: ['structural', 'conceptual', 'grumpy'],
};

describe('UploadStep', () => {
  beforeEach(() => {
    window.localStorage.setItem('dod_studio_tutorial_seen_v1', '1');
  });

  it('shows guest sign-up messaging and blocks the second submission path', () => {
    const onGuestUpgradeRequired = jest.fn();
    const onAuthRequired = jest.fn();
    const onUpgradeClick = jest.fn();

    render(
      <UploadStep
        getRootProps={(() => ({})) as never}
        getInputProps={(() => ({})) as never}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={jest.fn()}
        handleMultiAnalyze={jest.fn()}
        handleAutoConcept={jest.fn()}
        handleMaterialBoard={jest.fn()}
        handleDesignInsight={jest.fn()}
        image={null}
        imageBase64={null}
        additionalUploads={[]}
        uploadValidationError={null}
        isRevisionMode={false}
        isAuthenticated={false}
        onAuthRequired={onAuthRequired}
        isPremiumUser={false}
        rapidoPens={12}
        onUpgradeClick={onUpgradeClick}
        isAnonymous
        guestDrawingCount={1}
        onGuestUpgradeRequired={onGuestUpgradeRequired}
      />,
    );

    expect(screen.getByRole('button', { name: /misafir limiti|guest limit reached/i }).hasAttribute('disabled')).toBe(true);
    expect(onGuestUpgradeRequired).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Hesap Oluştur' }));
    expect(onAuthRequired).toHaveBeenCalledTimes(1);
    expect(onUpgradeClick).not.toHaveBeenCalled();
  });

  it('links Studio Desk labels to their inputs and labels icon-only controls', () => {
    render(
      <UploadStep
        getRootProps={(() => ({})) as never}
        getInputProps={(() => ({})) as never}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={jest.fn()}
        handleMultiAnalyze={jest.fn()}
        handleAutoConcept={jest.fn()}
        handleMaterialBoard={jest.fn()}
        handleDesignInsight={jest.fn()}
        image={null}
        imageBase64={null}
        additionalUploads={[]}
        uploadValidationError={null}
        isRevisionMode={false}
        isAuthenticated
        onAuthRequired={jest.fn()}
        isPremiumUser
        rapidoPens={24}
        onUpgradeClick={jest.fn()}
        isAnonymous={false}
        guestDrawingCount={0}
      />,
    );

    expect(screen.getByLabelText('Konu')).toHaveValue('Brutalist Library');
    expect(screen.getByLabelText('Arazi')).toHaveValue('Istanbul');
    expect(screen.getByLabelText('Konsept')).toHaveValue('Light wells and circulation');
    expect(screen.getByLabelText('Kategori')).toBeInTheDocument();
    expect(screen.getByLabelText('Analiz Uzunluğu')).toBeInTheDocument();
    expect(screen.getByLabelText('Jüri Sertliği')).toHaveAttribute('type', 'range');
    expect(screen.getByRole('button', { name: 'Önceki persona' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sonraki persona' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /önce dosya yükle/i })).toBeDisabled();
  });

  it('routes authenticated premium users to the main analysis actions', () => {
    const handleAnalyze = jest.fn();
    const handleMultiAnalyze = jest.fn();
    const handleAutoConcept = jest.fn();
    const handleMaterialBoard = jest.fn();
    const handleDesignInsight = jest.fn();

    render(
      <UploadStep
        getRootProps={(() => ({})) as never}
        getInputProps={(() => ({})) as never}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={handleAnalyze}
        handleMultiAnalyze={handleMultiAnalyze}
        handleAutoConcept={handleAutoConcept}
        handleMaterialBoard={handleMaterialBoard}
        handleDesignInsight={handleDesignInsight}
        image={new File(['x'], 'design.png', { type: 'image/png' })}
        imageBase64={'encoded-image'}
        additionalUploads={[]}
        uploadValidationError={null}
        isRevisionMode={false}
        isAuthenticated
        onAuthRequired={jest.fn()}
        isPremiumUser
        rapidoPens={24}
        onUpgradeClick={jest.fn()}
        isAnonymous={false}
        guestDrawingCount={0}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /jüri karşısına çık/i }));
    fireEvent.click(screen.getByRole('button', { name: /çoklu jüri \(3 persona\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /konsept analizi ve önerisi|concept analysis/i }));
    fireEvent.click(screen.getByRole('button', { name: /malzeme analizi/i }));
    fireEvent.click(screen.getByRole('button', { name: /çizim tutarlılığını denetle|check drawing consistency/i }));
    fireEvent.click(screen.getByRole('button', { name: /dolaşımı denetle|check circulation/i }));
    fireEvent.click(screen.getByRole('button', { name: /erişilebilirliği ön kontrol et|pre-check accessibility/i }));

    expect(handleAnalyze).toHaveBeenCalledTimes(1);
    expect(handleMultiAnalyze).toHaveBeenCalledTimes(1);
    expect(handleAutoConcept).toHaveBeenCalledTimes(1);
    expect(handleMaterialBoard).toHaveBeenCalledTimes(1);
    expect(handleDesignInsight).toHaveBeenNthCalledWith(1, 'DRAWING_CONSISTENCY');
    expect(handleDesignInsight).toHaveBeenNthCalledWith(2, 'CIRCULATION_ADJACENCY');
    expect(handleDesignInsight).toHaveBeenNthCalledWith(3, 'ACCESSIBILITY_EGRESS');
  });

  it('keeps analysis disabled while upload payload is still processing', () => {
    const handleAnalyze = jest.fn();

    render(
      <UploadStep
        getRootProps={(() => ({})) as never}
        getInputProps={(() => ({})) as never}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={handleAnalyze}
        handleMultiAnalyze={jest.fn()}
        handleAutoConcept={jest.fn()}
        handleMaterialBoard={jest.fn()}
        handleDesignInsight={jest.fn()}
        image={new File(['x'], 'design.pdf', { type: 'application/pdf' })}
        imageBase64={null}
        additionalUploads={[]}
        uploadValidationError={null}
        isRevisionMode={false}
        isAuthenticated
        onAuthRequired={jest.fn()}
        isPremiumUser
        rapidoPens={24}
        onUpgradeClick={jest.fn()}
        isAnonymous={false}
        guestDrawingCount={0}
      />,
    );

    const button = screen.getByRole('button', { name: /dosya işleniyor/i });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(handleAnalyze).not.toHaveBeenCalled();
  });

  it('shows the first-run tutorial as an accessible dialog that closes with Escape', async () => {
    window.localStorage.removeItem('dod_studio_tutorial_seen_v1');

    render(
      <UploadStep
        getRootProps={(() => ({})) as never}
        getInputProps={(() => ({})) as never}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={jest.fn()}
        handleMultiAnalyze={jest.fn()}
        handleAutoConcept={jest.fn()}
        handleMaterialBoard={jest.fn()}
        handleDesignInsight={jest.fn()}
        image={null}
        imageBase64={null}
        additionalUploads={[]}
        uploadValidationError={null}
        isRevisionMode={false}
        isAuthenticated
        onAuthRequired={jest.fn()}
        isPremiumUser
        rapidoPens={24}
        onUpgradeClick={jest.fn()}
        isAnonymous={false}
        guestDrawingCount={0}
      />,
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('dod_studio_tutorial_seen_v1')).toBe('1');
  });
});
