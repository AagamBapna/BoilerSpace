import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../components/SearchBar';

// ─── Sample data ──────────────────────────────────────────────────────────────

const sampleBuildings = [
    {
        _id: 'b001',
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.91370,
        amenities: ['Wi-Fi', 'Outlets'],
    },
    {
        _id: 'b002',
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        amenities: ['Wi-Fi', 'Computer Labs'],
    },
    {
        _id: 'b003',
        name: 'Hicks Undergraduate Library',
        abbreviation: 'HIKS',
        latitude: 40.42450,
        longitude: -86.91230,
        amenities: ['Quiet Zones', 'Printers'],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSearchBar(overrides = {}) {
    const props = {
        buildings: sampleBuildings,
        onSelectBuilding: vi.fn(),
        onSearchChange: vi.fn(),
        ...overrides,
    };
    const result = render(<SearchBar {...props} />);
    return { ...result, ...props };
}

/** Type into the search input and wait for the 200ms debounce to settle. */
async function typeAndDebounce(user, input, text) {
    await user.type(input, text);
    // Wait for debounce (200ms) + a buffer
    await act(async () => {
        await new Promise((r) => setTimeout(r, 250));
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchBar — Rendering', () => {
    test('renders search input with correct placeholder', () => {
        renderSearchBar();
        expect(screen.getByPlaceholderText(/Search buildings/)).toBeInTheDocument();
    });

    test('input has combobox role for accessibility', () => {
        renderSearchBar();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('does not show dropdown when input is empty', () => {
        renderSearchBar();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('does not show clear button when input is empty', () => {
        renderSearchBar();
        expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });
});

describe('SearchBar — Debounced Filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('shows dropdown results after typing and debounce', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input); // focus
        await typeAndDebounce(user, input, 'Law');

        expect(screen.getByRole('listbox')).toBeInTheDocument();
        // Building name is split across <mark> and <span> by HighlightMatch,
        // so we check the option's textContent instead of getByText
        const option = screen.getByRole('option');
        expect(option.textContent).toContain('Lawson Computer Science Building');
    });

    test('filters by building name (case-insensitive)', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'hicks');

        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        // Only Hicks should match — check via option textContent
        // since HighlightMatch splits text across elements
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0].textContent).toContain('Hicks Undergraduate Library');
    });

    test('filters by abbreviation', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'LWSN');

        expect(screen.getByText(/Lawson Computer Science Building/)).toBeInTheDocument();
        expect(screen.queryByText(/Wilmeth Active Learning Center/)).not.toBeInTheDocument();
    });

    test('shows "No buildings found" for unmatched query', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'ZZZZZ');

        expect(screen.getByText(/No buildings found/)).toBeInTheDocument();
    });

    test('calls onSearchChange with debounced query', async () => {
        const user = userEvent.setup();
        const { onSearchChange } = renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'WALC');

        expect(onSearchChange).toHaveBeenCalledWith('WALC');
    });

    test('sorts exact abbreviation match first', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        // "WALC" matches Wilmeth by abbreviation AND name contains "WALC"
        await typeAndDebounce(user, input, 'WALC');

        const options = screen.getAllByRole('option');
        // WALC (exact abbreviation match) should be the first result
        expect(options[0]).toHaveTextContent('WALC');
    });
});

describe('SearchBar — Highlight Matches', () => {
    test('highlights matched text with <mark> tags', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'Law');

        const marks = screen.getAllByText('Law');
        const markElements = marks.filter((el) => el.tagName === 'MARK');
        expect(markElements.length).toBeGreaterThanOrEqual(1);
    });
});

describe('SearchBar — Clear Button', () => {
    test('shows clear button when input has text', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.type(input, 'test');
        expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    test('clears input and hides dropdown when clear is clicked', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'WALC');
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        await user.click(screen.getByLabelText('Clear search'));

        expect(input).toHaveValue('');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('calls onSearchChange with empty string after clear', async () => {
        const user = userEvent.setup();
        const { onSearchChange } = renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'WALC');
        onSearchChange.mockClear();

        await user.click(screen.getByLabelText('Clear search'));

        await waitFor(() => {
            expect(onSearchChange).toHaveBeenCalledWith('');
        });
    });
});

describe('SearchBar — Keyboard Navigation', () => {
    test('ArrowDown moves active index through results', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        // Type a broad query to get multiple results
        await typeAndDebounce(user, input, 'i');

        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(1);

        // Press ArrowDown — first item should be active
        await user.keyboard('{ArrowDown}');
        expect(options[0]).toHaveAttribute('aria-selected', 'true');

        // Press ArrowDown again — second item should be active
        await user.keyboard('{ArrowDown}');
        expect(options[1]).toHaveAttribute('aria-selected', 'true');
        expect(options[0]).toHaveAttribute('aria-selected', 'false');
    });

    test('ArrowUp wraps to last item from top', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'i');

        const options = screen.getAllByRole('option');

        // Press ArrowDown to select first, then ArrowUp to wrap
        await user.keyboard('{ArrowDown}');
        expect(options[0]).toHaveAttribute('aria-selected', 'true');

        await user.keyboard('{ArrowUp}');
        // Should wrap to last item
        expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
    });

    test('Enter selects the active result and calls onSelectBuilding', async () => {
        const user = userEvent.setup();
        const { onSelectBuilding } = renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'Law');

        await user.keyboard('{ArrowDown}');
        await user.keyboard('{Enter}');

        expect(onSelectBuilding).toHaveBeenCalledTimes(1);
        expect(onSelectBuilding).toHaveBeenCalledWith(
            expect.objectContaining({ abbreviation: 'LWSN' })
        );
    });

    test('Enter does nothing when no item is active', async () => {
        const user = userEvent.setup();
        const { onSelectBuilding } = renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'Law');

        // Press Enter without ArrowDown first (activeIndex is -1)
        await user.keyboard('{Enter}');

        expect(onSelectBuilding).not.toHaveBeenCalled();
    });

    test('Escape clears the query and closes dropdown', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'WALC');
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(input).toHaveValue('');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});

describe('SearchBar — Selection Behavior', () => {
    test('clicking a result calls onSelectBuilding with the correct building', async () => {
        const user = userEvent.setup();
        const { onSelectBuilding } = renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'Hicks');

        const option = screen.getByRole('option');
        await user.click(option);

        expect(onSelectBuilding).toHaveBeenCalledWith(
            expect.objectContaining({ _id: 'b003', abbreviation: 'HIKS' })
        );
    });

    test('selecting a result clears the input', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'Hicks');

        const option = screen.getByRole('option');
        await user.click(option);

        expect(input).toHaveValue('');
    });
});

describe('SearchBar — ARIA Attributes', () => {
    test('input has aria-expanded=false when dropdown is hidden', () => {
        renderSearchBar();
        const input = screen.getByRole('combobox');
        expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    test('input has aria-expanded=true when dropdown is visible', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'WALC');

        expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    test('result items have role=option', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'Law');

        const options = await screen.findAllByRole('option');
        expect(options.length).toBeGreaterThanOrEqual(1);
    });

    test('aria-activedescendant updates with keyboard nav', async () => {
        const user = userEvent.setup();
        renderSearchBar();
        const input = screen.getByPlaceholderText(/Search buildings/);

        await user.click(input);
        await typeAndDebounce(user, input, 'Law');

        // Before navigation, no activedescendant
        expect(input).not.toHaveAttribute('aria-activedescendant');

        await user.keyboard('{ArrowDown}');

        // After navigation, activedescendant should point to the active option
        expect(input).toHaveAttribute('aria-activedescendant', 'search-result-b002');
    });
});