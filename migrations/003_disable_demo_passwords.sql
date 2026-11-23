-- Las cuentas de demostración no pueden iniciar sesión con una contraseña conocida.
select set_config('app.seed', 'on', true);

update profiles
set password_hash = 'disabled'
where is_demo = true;
