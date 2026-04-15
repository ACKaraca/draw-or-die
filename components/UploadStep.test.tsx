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

  it('shows guest upgrade messaging and blocks the second submission path', () => {
    const onGuestUpgradeRequired = jest.fn();

    render(
      <UploadStep
        getRootProps={() => ({})}
        getInputProps={() => ({})}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={jest.fn()}
        handleMultiAnalyze={jest.fn()}
        handleAutoConcept={jest.fn()}
        handleMaterialBoard={jest.fn()}
        image={null}
        imageBase64={null}
        additionalUploads={[]}
        uploadValidationError={null}
        isRevisionMode={false}
        isAuthenticated={false}
        onAuthRequired={jest.fn()}
        isPremiumUser={false}
        rapidoPens={12}
        onUpgradeClick={jest.fn()}
        isAnonymous
        guestDrawingCount={1}
        onGuestUpgradeRequired={onGuestUpgradeRequired}
      />,
    );

    expect(screen.getByRole('button', { name: /şimdi yükselt|upgrade now/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /misafir limiti|guest limit reached/i }).hasAttribute('disabled')).toBe(true);
    expect(onGuestUpgradeRequired).not.toHaveBeenCalled();
  });

  it('routes authenticated premium users to the main analysis actions', () => {
    const handleAnalyze = jest.fn();
    const handleMultiAnalyze = jest.fn();
    const handleAutoConcept = jest.fn();
    const handleMaterialBoard = jest.fn();

    render(
      <UploadStep
        getRootProps={() => ({})}
        getInputProps={() => ({})}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={handleAnalyze}
        handleMultiAnalyze={handleMultiAnalyze}
        handleAutoConcept={handleAutoConcept}
        handleMaterialBoard={handleMaterialBoard}
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

    expect(handleAnalyze).toHaveBeenCalledTimes(1);
    expect(handleMultiAnalyze).toHaveBeenCalledTimes(1);
    expect(handleAutoConcept).toHaveBeenCalledTimes(1);
    expect(handleMaterialBoard).toHaveBeenCalledTimes(1);
  });

  it('keeps analysis disabled while upload payload is still processing', () => {
    const handleAnalyze = jest.fn();

    render(
      <UploadStep
        getRootProps={() => ({})}
        getInputProps={() => ({})}
        isDragActive={false}
        previewUrl={null}
        mimeType={null}
        formData={baseFormData as any}
        setFormData={jest.fn()}
        handleAnalyze={handleAnalyze}
        handleMultiAnalyze={jest.fn()}
        handleAutoConcept={jest.fn()}
        handleMaterialBoard={jest.fn()}
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
});
