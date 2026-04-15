import { fireEvent, render, screen } from '@testing-library/react';
import { InteractiveImagePreview } from '@/components/InteractiveImagePreview';

describe('InteractiveImagePreview', () => {
  it('supports wheel zoom and hides usage hint after interaction', () => {
    const { container } = render(
      <div style={{ width: 480, height: 360 }}>
        <InteractiveImagePreview
          src="https://example.com/test-image.png"
          alt="Test preview"
          fileName="test.png"
        />
      </div>,
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/Yakınlaştırmak için tekerlek|Use wheel or two fingers/i)).toBeInTheDocument();

    const viewport = container.querySelector('[data-testid="interactive-image-preview"] > div:last-child') as HTMLElement;
    fireEvent.wheel(viewport, { deltaY: -120 });

    expect(screen.getByText('115%')).toBeInTheDocument();
    expect(screen.queryByText(/Yakınlaştırmak için tekerlek|Use wheel or two fingers/i)).not.toBeInTheDocument();
  });
});
