// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Card from './Card.jsx';

describe('Card', () => {
  describe('deck1 (default photo PNG theme)', () => {
    it.each(['nope', 'boom', 'reverse', 'taco', 'potato'])(
      'renders <img class="card__art-img" /> for "%s" by default',
      (type) => {
        const { container } = render(
          <Card type={type} label={`Card ${type}`} ruleText="Test rule" />
        );

        const cardEl = container.querySelector('.card');
        expect(cardEl).not.toBeNull();
        expect(cardEl).toHaveClass('card--image');
        expect(cardEl).toHaveClass('card--theme-deck1');
        expect(cardEl).toHaveAttribute('data-card-theme', 'deck1');

        const artImg = container.querySelector('img.card__art-img');
        expect(artImg).not.toBeNull();
        expect(artImg.getAttribute('src')).toBeTruthy();

        expect(container.querySelector('.card__name-strip')).toBeNull();
        expect(container.querySelector('.card__rule-box')).toBeNull();
      }
    );

    it('renders structured fallback with PEEK_ILLUSTRATION for locale="en" and type="peek"', () => {
      const { container } = render(
        <Card
          type="peek"
          locale="en"
          label="See The Future"
          ruleText="Privately view the top 3 cards"
        />
      );

      const cardEl = container.querySelector('.card');
      expect(cardEl).not.toHaveClass('card--image');
      expect(cardEl).toHaveAttribute('data-card-theme', 'deck1');
      expect(container.querySelector('img.card__art-img')).toBeNull();
      expect(container.querySelector('.card__name-strip')).not.toBeNull();
      expect(container.querySelector('.card__rule-box')).not.toBeNull();

      const illustrationImg = container.querySelector('img.card__illustration-img');
      expect(illustrationImg).not.toBeNull();
      expect(illustrationImg.getAttribute('src')).toBeTruthy();
    });
  });

  describe('deck2 (Classic Vector theme)', () => {
    it('renders structured vector layout and NO .card__art-img', () => {
      const { container } = render(
        <Card
          type="nope"
          cardTheme="deck2"
          label="Chặn"
          ruleText="Hủy hành động vừa đánh"
        />
      );

      const cardEl = container.querySelector('.card');
      expect(cardEl).toHaveClass('card--theme-deck2');
      expect(cardEl).not.toHaveClass('card--image');
      expect(cardEl).toHaveAttribute('data-card-theme', 'deck2');

      expect(container.querySelector('img.card__art-img')).toBeNull();
      expect(container.querySelector('.card__group-icon')).not.toBeNull();
      expect(container.querySelector('.card__name-strip')).not.toBeNull();
      expect(container.querySelector('.card__illustration-area')).not.toBeNull();
      expect(container.querySelector('.card__illustration-svg')).not.toBeNull();
      expect(container.querySelector('.card__rule-box')).not.toBeNull();
    });
  });

  describe('deck3 (Dark / Neon theme)', () => {
    it('adds .card--theme-deck3 and renders structured vector layout without .card__art-img', () => {
      const { container } = render(
        <Card
          type="reverse"
          cardTheme="deck3"
          label="Đảo Chiều"
          ruleText="Đảo ngược chiều chơi"
        />
      );

      const cardEl = container.querySelector('.card');
      expect(cardEl).toHaveClass('card--theme-deck3');
      expect(cardEl).not.toHaveClass('card--image');
      expect(cardEl).toHaveAttribute('data-card-theme', 'deck3');

      expect(container.querySelector('img.card__art-img')).toBeNull();
      expect(container.querySelector('.card__group-icon')).not.toBeNull();
      expect(container.querySelector('.card__name-strip')).not.toBeNull();
      expect(container.querySelector('.card__illustration-area')).not.toBeNull();
      expect(container.querySelector('.card__illustration-svg')).not.toBeNull();
      expect(container.querySelector('.card__rule-box')).not.toBeNull();
    });
  });

  describe('faceDown across all themes', () => {
    it.each(['deck1', 'deck2', 'deck3'])(
      'hides card type/identity while applying deck card-back theme for cardTheme="%s"',
      (cardTheme) => {
        const { container } = render(
          <Card
            type="boom"
            label="Mèo Bùm"
            ruleText="Nổ ngay"
            cardTheme={cardTheme}
            faceDown
          />
        );

        const cardEl = container.querySelector('.card');
        expect(cardEl).toHaveClass('card--face-down');
        expect(cardEl).not.toHaveClass('card--boom');
        expect(cardEl).not.toHaveClass('card--image');
        expect(cardEl).toHaveClass(`card--theme-${cardTheme}`);
        expect(cardEl).toHaveAttribute('data-card-theme', cardTheme);
        expect(cardEl).toHaveAttribute('aria-label', 'Card face down');

        expect(container.querySelector('.card__back')).not.toBeNull();
        expect(
          container.querySelector(`[data-card-back-theme="${cardTheme}"]`)
        ).not.toBeNull();
        expect(container.querySelector('img.card__art-img')).toBeNull();
        expect(container.querySelector('.card__name-strip')).toBeNull();
        expect(container.querySelector('.card__group-icon')).toBeNull();
        expect(container.querySelector('.card__rule-box')).toBeNull();
      }
    );
  });

  describe('interactive, selected, and disabled states', () => {
    it('renders selected and disabled badges on image cards and handles clicks', () => {
      const handleClick = vi.fn();
      const { container, rerender } = render(
        <Card
          type="taco"
          label="Mèo Taco"
          selected
          onClick={handleClick}
        />
      );

      let cardEl = container.querySelector('.card');
      expect(cardEl).toHaveClass('card--image', 'card--selected', 'card--interactive');
      expect(cardEl).toHaveAttribute('aria-selected', 'true');
      expect(container.querySelector('.card__selected-badge')).not.toBeNull();

      fireEvent.click(cardEl);
      expect(handleClick).toHaveBeenCalledTimes(1);

      rerender(
        <Card
          type="taco"
          label="Mèo Taco"
          disabled
          onClick={handleClick}
        />
      );

      cardEl = container.querySelector('.card');
      expect(cardEl).toHaveClass('card--image', 'card--disabled');
      expect(cardEl).toHaveAttribute('aria-disabled', 'true');
      expect(container.querySelector('.card__disabled-badge')).not.toBeNull();

      fireEvent.click(cardEl);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
