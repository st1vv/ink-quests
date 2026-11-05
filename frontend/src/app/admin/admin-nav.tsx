import { NavLink } from "react-router";

const PAGES = [
  // end: only the exact path counts, so /admin isn't lit on its sub-pages.
  { to: "/admin", label: "Statistics", end: true },
  { to: "/admin/posts", label: "Posts" },
  { to: "/admin/xp", label: "XP" },
  // Lit on a user's page (/admin/users/0x…) too.
  { to: "/admin/users", label: "Users" },
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
        end={page.end}
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
