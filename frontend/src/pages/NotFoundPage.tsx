import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section className="space-y-4 text-center">
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <Link to="/" className="text-sky-400 hover:underline">
        Return home
      </Link>
    </section>
  );
}

export default NotFoundPage;
