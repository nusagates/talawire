# Design Guidelines

1. **Clean White Aesthetic**: The UI must strictly follow a clean, minimalist white aesthetic similar to Google or Meta.
2. **Colors**: Use crisp white backgrounds (`bg-white`), light gray for secondary surfaces (`bg-gray-50` or `bg-gray-100`), and a primary brand color like Google Blue (`bg-blue-600`) or Meta Blue (`bg-blue-500`) for actions. Avoid dark modes or heavy gradients.
3. **Typography**: Use standard, clean sans-serif fonts (like Inter, Roboto, or standard system fonts). Text should be highly readable, using dark gray (`text-gray-900`) for primary text and medium gray (`text-gray-600`) for secondary text.
4. **Components**: Use subtle borders (`border-gray-200`) and soft shadows (`shadow-sm` or `shadow-md`) instead of heavy glassmorphism. Corners should be gently rounded (`rounded-md` or `rounded-lg`).

5. **No Native Dialogs**: Strictly avoid using native browser dialogs such as `alert()`, `prompt()`, or `confirm()` for any notifications, dialogs, or user inputs. Always use custom UI components (like modals, toasts, or custom dialogs) instead.
