/**
 * Plantillas de Email HTML para VeciApp
 */

const { serverIp, port } = require('../config/env')

// URL del logo (servido desde el backend)
const getLogoUrl = () => `http://${serverIp}:${port}/assets/logo-veciapp.png`

// Template base para todos los emails
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VeciApp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      background-color: #f8f9fa; 
      padding: 20px; 
    }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 16px; 
      overflow: hidden; 
      box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
    }
    .header { 
      background: linear-gradient(135deg, #2A9D8F 0%, #667eea 100%); 
      padding: 40px 20px; 
      text-align: center; 
    }
    .logo-container { 
      background: white; 
      width: 140px; 
      height: 140px; 
      border-radius: 70px; 
      margin: 0 auto 20px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      padding: 15px;
    }
    .logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .header-title { 
      color: white; 
      font-size: 32px; 
      font-weight: 800; 
      margin-bottom: 8px; 
      text-shadow: 0 2px 10px rgba(0,0,0,0.2); 
    }
    .header-subtitle { 
      color: rgba(255,255,255,0.95); 
      font-size: 16px; 
      font-weight: 500; 
    }
    .content { 
      padding: 40px 30px; 
    }
    .greeting { 
      font-size: 24px; 
      font-weight: 700; 
      color: #2c3e50; 
      margin-bottom: 20px; 
    }
    .message { 
      font-size: 16px; 
      color: #555; 
      line-height: 1.8; 
      margin-bottom: 30px; 
    }
    .info-box { 
      background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); 
      border-left: 4px solid #2A9D8F; 
      padding: 20px; 
      border-radius: 12px; 
      margin-bottom: 30px; 
    }
    .info-box-title { 
      font-size: 18px; 
      font-weight: 700; 
      color: #2A9D8F; 
      margin-bottom: 12px; 
    }
    .info-box-text { 
      font-size: 15px; 
      color: #555; 
      line-height: 1.6; 
    }
    .button-container { 
      text-align: center; 
      margin: 35px 0; 
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, #2A9D8F 0%, #667eea 100%); 
      color: white; 
      text-decoration: none; 
      padding: 18px 40px; 
      border-radius: 30px; 
      font-size: 18px; 
      font-weight: 700; 
      box-shadow: 0 8px 20px rgba(42, 157, 143, 0.3); 
      transition: transform 0.2s; 
    }
    .button:hover { 
      transform: translateY(-2px); 
      box-shadow: 0 12px 30px rgba(42, 157, 143, 0.4); 
    }
    .features { 
      background: #f8f9fa; 
      border-radius: 12px; 
      padding: 25px; 
      margin-bottom: 30px; 
    }
    .feature-item { 
      display: flex; 
      align-items: flex-start; 
      margin-bottom: 15px; 
    }
    .feature-item:last-child { 
      margin-bottom: 0; 
    }
    .feature-icon { 
      font-size: 20px; 
      margin-right: 12px; 
      flex-shrink: 0; 
    }
    .feature-text { 
      font-size: 15px; 
      color: #555; 
      line-height: 1.6; 
    }
    .warning-box { 
      background: #fff3cd; 
      border-left: 4px solid #ffc107; 
      padding: 15px; 
      border-radius: 8px; 
      margin-bottom: 25px; 
    }
    .warning-text { 
      font-size: 14px; 
      color: #856404; 
      font-weight: 600; 
    }
    .footer { 
      background: #2c3e50; 
      padding: 30px; 
      text-align: center; 
      color: rgba(255,255,255,0.8); 
    }
    .footer-text { 
      font-size: 14px; 
      line-height: 1.6; 
    }
    .footer-brand { 
      font-size: 18px; 
      font-weight: 700; 
      color: white; 
      margin-bottom: 8px; 
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${content}
  </div>
</body>
</html>
`

// Template para email de activación de vendedor
const emailActivacionVendedor = ({ nombre, emprendimientoNombre, enlaceActivacion }) => {
  const logoUrl = getLogoUrl()
  const content = `
    <div class="header">
      <div class="logo-container">
        <img src="${logoUrl}" alt="VeciApp Logo" class="logo-img" />
      </div>
      <div class="header-subtitle">Tu comunidad, más conectada</div>
    </div>
    
    <div class="content">
      <div class="greeting">¡Hola ${nombre}! 👋</div>
      
      <div class="message">
        <strong>¡Bienvenido a VeciApp!</strong> 🎊
        <br><br>
        Has sido invitado a ser vendedor del emprendimiento <strong>"${emprendimientoNombre}"</strong>.
        <br><br>
        Para activar tu cuenta y comenzar a gestionar pedidos, haz clic en el botón de abajo:
      </div>
      
      <div class="button-container">
        <a href="${enlaceActivacion}" class="button">
          🔓 Activar Mi Cuenta
        </a>
      </div>
      
      <div class="warning-box">
        <div class="warning-text">
          ⚠️ Este enlace expirará en 24 horas
        </div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">📱 Una vez activada tu cuenta, podrás:</div>
        <div class="features">
          <div class="feature-item">
            <div class="feature-icon">✅</div>
            <div class="feature-text">Ver y gestionar todos los pedidos del emprendimiento</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">✅</div>
            <div class="feature-text">Cambiar estados de pedidos en tiempo real</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">✅</div>
            <div class="feature-text">Comunicarte directamente con los clientes</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">✅</div>
            <div class="feature-text">Recibir notificaciones de nuevos pedidos</div>
          </div>
        </div>
      </div>
      
      <div class="message" style="font-size: 14px; color: #777; margin-top: 20px;">
        Si no solicitaste esta cuenta, puedes ignorar este correo.
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-brand">VeciApp</div>
      <div class="footer-text">
        Tu comunidad, más conectada
        <br>
        © ${new Date().getFullYear()} VeciApp. Todos los derechos reservados.
      </div>
    </div>
  `
  
  return baseTemplate(content)
}

// Template para email de confirmación de activación
const emailConfirmacionActivacion = ({ nombre, correo }) => {
  const logoUrl = getLogoUrl()
  const content = `
    <div class="header">
      <div class="logo-container">
        <img src="${logoUrl}" alt="VeciApp Logo" class="logo-img" />
      </div>
      <div class="header-subtitle">Tu comunidad, más conectada</div>
    </div>
    
    <div class="content">
      <div class="greeting">¡Hola ${nombre}! 🎉</div>
      
      <div class="message">
        <strong>¡Tu cuenta de vendedor ha sido activada exitosamente!</strong>
        <br><br>
        Ya puedes iniciar sesión en la aplicación VeciApp y comenzar a gestionar pedidos.
      </div>
      
      <div class="info-box">
        <div class="info-box-title">🔐 Tus Credenciales de Acceso:</div>
        <div class="info-box-text">
          <strong>📧 Correo:</strong> ${correo}
          <br>
          <strong>🔑 Contraseña:</strong> La que configuraste al registrarte
        </div>
      </div>
      
      <div class="features">
        <div class="feature-item">
          <div class="feature-icon">📱</div>
          <div class="feature-text">
            <strong>Paso 1:</strong> Abre la aplicación VeciApp en tu dispositivo móvil
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🔓</div>
          <div class="feature-text">
            <strong>Paso 2:</strong> Inicia sesión con tu correo y contraseña
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🚀</div>
          <div class="feature-text">
            <strong>Paso 3:</strong> Comienza a gestionar los pedidos del emprendimiento
          </div>
        </div>
      </div>
      
      <div class="message" style="font-size: 14px; color: #777; margin-top: 30px; text-align: center;">
        ¿Necesitas ayuda? Contacta al administrador del emprendimiento
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-brand">VeciApp</div>
      <div class="footer-text">
        Tu comunidad, más conectada
        <br>
        © ${new Date().getFullYear()} VeciApp. Todos los derechos reservados.
      </div>
    </div>
  `
  
  return baseTemplate(content)
}

// Template para email de bienvenida (nuevos usuarios)
const emailBienvenida = ({ nombre, tipoUsuario, correo, enlaceVerificacion }) => {
  const logoUrl = getLogoUrl()
  const esEmprendedor = tipoUsuario === 'emprendedor'
  
  const content = `
    <div class="header">
      <div class="logo-container">
        <img src="${logoUrl}" alt="VeciApp Logo" class="logo-img" />
      </div>
      <div class="header-subtitle">Tu comunidad, más conectada</div>
    </div>
    
    <div class="content">
      <div class="greeting">¡Bienvenido a VeciApp, ${nombre}! 🎉</div>
      
      <div class="message">
        <strong>¡Gracias por unirte a nuestra comunidad!</strong>
        <br><br>
        Tu cuenta ha sido creada exitosamente como <strong>${esEmprendedor ? 'Emprendedor' : 'Cliente'}</strong>.
        <br><br>
        <strong>Para comenzar a usar VeciApp, primero debes verificar tu correo electrónico.</strong>
      </div>
      
      <div class="button-container">
        <a href="${enlaceVerificacion}" class="button">
          ✉️ Verificar Mi Correo
        </a>
      </div>
      
      <div class="warning-box">
        <div class="warning-text">
          ⚠️ Este enlace expirará en 48 horas
        </div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">🔐 Tus Credenciales de Acceso:</div>
        <div class="info-box-text">
          <strong>📧 Correo:</strong> ${correo}
          <br>
          <strong>🔑 Contraseña:</strong> La que configuraste al registrarte
          <br><br>
          <em>Una vez verificado tu correo, podrás iniciar sesión en la app.</em>
        </div>
      </div>
      
      <div class="features">
        ${esEmprendedor ? `
          <div class="feature-item">
            <div class="feature-icon">🏪</div>
            <div class="feature-text">
              <strong>Crea tu emprendimiento</strong> y muestra tus productos a la comunidad
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📦</div>
            <div class="feature-text">
              <strong>Gestiona productos</strong> con fotos, precios y categorías
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <div class="feature-text">
              <strong>Recibe pedidos</strong> y gestiona ventas en tiempo real
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">⭐</div>
            <div class="feature-text">
              <strong>Actualiza a Premium</strong> para tener hasta 3 emprendimientos y 30 productos cada uno
            </div>
          </div>
        ` : `
          <div class="feature-item">
            <div class="feature-icon">🛒</div>
            <div class="feature-text">
              <strong>Explora emprendimientos</strong> locales cerca de ti
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🎯</div>
            <div class="feature-text">
              <strong>Compra productos</strong> y servicios de tu comunidad
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🚚</div>
            <div class="feature-text">
              <strong>Recibe a domicilio</strong> o retira en el local
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">⭐</div>
            <div class="feature-text">
              <strong>Califica y apoya</strong> a tus emprendedores favoritos
            </div>
          </div>
        `}
      </div>
      
      <div class="message" style="font-size: 14px; color: #777; margin-top: 30px; text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <strong>¿Problemas con el enlace?</strong><br>
        Copia y pega esta URL en tu navegador:<br>
        <code style="font-size: 11px; word-break: break-all; color: #2A9D8F;">${enlaceVerificacion}</code>
      </div>
      
      <div class="message" style="font-size: 13px; color: #999; margin-top: 20px; text-align: center;">
        Si no creaste esta cuenta, puedes ignorar este correo.
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-brand">VeciApp</div>
      <div class="footer-text">
        Tu comunidad, más conectada
        <br>
        © ${new Date().getFullYear()} VeciApp. Todos los derechos reservados.
      </div>
    </div>
  `
  
  return baseTemplate(content)
}

// Template para email de código de recuperación de contraseña
const emailRecuperacionPassword = ({ nombre, codigo }) => {
  const logoUrl = getLogoUrl()
  
  const content = `
    <div class="header">
      <div class="logo-container">
        <img src="${logoUrl}" alt="VeciApp Logo" class="logo-img" />
      </div>
      <div class="header-subtitle">Tu comunidad, más conectada</div>
    </div>
    
    <div class="content">
      <div class="greeting">Hola${nombre ? ` ${nombre}` : ''}! 🔐</div>
      
      <div class="message">
        Has solicitado restablecer tu contraseña en VeciApp.
        <br><br>
        Usa el siguiente código de verificación de <strong>6 dígitos</strong> en la aplicación:
      </div>
      
      <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center;">
        <div style="font-size: 14px; color: #666; margin-bottom: 15px; font-weight: 600;">
          TU CÓDIGO DE VERIFICACIÓN
        </div>
        <div style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: inline-block; min-width: 280px;">
          <div style="font-size: 48px; font-weight: 900; color: #2A9D8F; letter-spacing: 12px; font-family: 'Courier New', monospace; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">
            ${codigo}
          </div>
        </div>
      </div>
      
      <div class="warning-box">
        <div class="warning-text">
          ⏰ Este código expirará en 5 minutos
        </div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">🛡️ Seguridad:</div>
        <div class="info-box-text">
          • No compartas este código con nadie<br>
          • Si no solicitaste este cambio, ignora este correo<br>
          • Tu contraseña actual sigue siendo válida hasta que la cambies
        </div>
      </div>
      
      <div class="features">
        <div class="feature-item">
          <div class="feature-icon">1️⃣</div>
          <div class="feature-text">
            Ingresa el código de 6 dígitos en la app
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">2️⃣</div>
          <div class="feature-text">
            Crea una nueva contraseña segura
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">3️⃣</div>
          <div class="feature-text">
            Inicia sesión con tu nueva contraseña
          </div>
        </div>
      </div>
      
      <div class="message" style="font-size: 13px; color: #999; margin-top: 30px; text-align: center;">
        Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-brand">VeciApp</div>
      <div class="footer-text">
        Tu comunidad, más conectada
        <br>
        © ${new Date().getFullYear()} VeciApp. Todos los derechos reservados.
      </div>
    </div>
  `
  
  return baseTemplate(content)
}

module.exports = {
  emailActivacionVendedor,
  emailConfirmacionActivacion,
  emailBienvenida,
  emailRecuperacionPassword
}

