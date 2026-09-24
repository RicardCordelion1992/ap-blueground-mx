import SignOutButton from './SignOutButton';

export default function AccessDenied({ email }: { email: string }) {
  return (
    <div className="max-w-md mx-auto mt-24 card p-8 text-center space-y-4">
      <h1 className="text-lg font-semibold">Acceso no autorizado</h1>
      <p className="text-sm text-gray-600">
        Tu correo <strong>{email}</strong> todavía no tiene acceso a esta plataforma. Pide a un
        administrador que te dé de alta desde la sección de Usuarios.
      </p>
      <SignOutButton className="btn-secondary" />
    </div>
  );
}
