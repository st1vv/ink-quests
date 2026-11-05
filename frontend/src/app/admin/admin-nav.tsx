import { NavLink } from "react-router";

const PAGES = [
  { to: "/admin", label: "Statistics" },
  { to: "/admin/posts", label: "Posts" },
  { to: "/admin/xp", label: "XP" },
];

// Tabs between the admin pages, styled like TabButton.
export const AdminNav = () => (
  <nav
    aria-label="Admin"
    className="flex w-fit gap-1 rounded-full border border-white/10 bg-black/20 p-1"
  >
    {PAGES.map((page) => (
      <NavLink
        key={page.to}
        to={page.to}
        // /admin would otherwise also match its sub-pages.
        end
        className={({ isActive }) =>
          `inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-ink-light ${
            isActive
              ? "bg-ink text-white"
              : "text-white/60 hover:bg-white/5 hover:text-white"
          }`
        }
      >
        {page.label}
      </NavLink>
    ))}
  </nav>
);
