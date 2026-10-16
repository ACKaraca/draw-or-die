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

  it('pans with arrow keys only while zoomed and the surface has focus, Home resets', () => {
    render(<InteractiveImagePreview src="https://example.com/test-image.png" alt="Test preview" />);
    const surface = screen.getByRole('group', { name: /Görsel önizleme|Image preview/i });
    const content = screen.getByAltText('Test preview').parentElement as HTMLElement;
    surface.focus();
    expect(document.activeElement).toBe(surface);

    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(content.style.transform).toBe('scale(1) translate(0px, 0px)');

    fireEvent.click(screen.getByRole('button', { name: /Yakınlaştır$|Zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /Yakınlaştır$|Zoom in/i }));
    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    fireEvent.keyDown(surface, { key: 'ArrowDown' });
    expect(content.style.transform).toBe('scale(1.5) translate(-26.666666666666668px, -26.666666666666668px)');

    // Keys on a nested control must not pan the image.
    fireEvent.keyDown(screen.getByRole('button', { name: /Sıfırla|Reset/i }), { key: 'ArrowLeft' });
    expect(content.style.transform).toContain('-26.666666666666668px, -26.666666666666668px');

    fireEvent.keyDown(surface, { key: 'Home' });
    expect(content.style.transform).toBe('scale(1) translate(0px, 0px)');
  });
});
