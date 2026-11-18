-- ============================================================================
-- BASE DE DATOS: GESTIÓN DE TICKETS Y EVENTOS TI
-- UNIVERSIDAD PRIVADA FRANKLIN ROOSEVELT
-- ============================================================================
CREATE DATABASE IF NOT EXISTS upfr_gestion_ti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE upfr_gestion_ti;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT '123',
    nombre_completo VARCHAR(120) NOT NULL,
    rol ENUM('admin', 'tech') NOT NULL DEFAULT 'tech',
    avatar_url TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE catalogos_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria VARCHAR(50) NOT NULL,
    valor VARCHAR(120) NOT NULL,
    activo TINYINT(1) DEFAULT 1
);

CREATE TABLE inventario_tintas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campus VARCHAR(80) NOT NULL,
    codigo_tinta VARCHAR(100) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE tickets_atencion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_ticket VARCHAR(25) NOT NULL UNIQUE,
    tecnico_id INT NOT NULL,
    canal VARCHAR(50) NOT NULL,
    campus VARCHAR(80) NOT NULL,
    lugar_atencion VARCHAR(80) NOT NULL,
    ambiente_detalle VARCHAR(150) NOT NULL,
    nombres_usuario VARCHAR(100) NOT NULL,
    apellidos_usuario VARCHAR(100) NOT NULL,
    colaborador VARCHAR(80) NOT NULL,
    servicio_requerido VARCHAR(120) NOT NULL,
    modelo_tinta VARCHAR(100) NULL,
    prioridad VARCHAR(40) NOT NULL,
    estado VARCHAR(40) NOT NULL,
    observaciones VARCHAR(200) NULL,
    fecha_cierre DATE NOT NULL,
    hora_cierre TIME NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
);

CREATE TABLE requerimientos_eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_rq VARCHAR(25) NOT NULL UNIQUE,
    tecnico_id INT NOT NULL,
    canal VARCHAR(50) NOT NULL,
    nombre_evento VARCHAR(200) NOT NULL,
    tipo_evento VARCHAR(80) NOT NULL,
    campus VARCHAR(80) NOT NULL,
    escuela_profesional VARCHAR(120) NULL,
    fecha_evento DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    persona_responsable VARCHAR(120) NOT NULL,
    celular VARCHAR(20) NOT NULL,
    equipos_solicitados TEXT NOT NULL,
    prioridad VARCHAR(40) NOT NULL,
    estado VARCHAR(40) NOT NULL,
    observaciones VARCHAR(200) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
);

CREATE TABLE licencias_meet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_ticket VARCHAR(25) NOT NULL,
    tecnico_id INT NOT NULL,
    nombres_usuario VARCHAR(100) NOT NULL,
    apellidos_usuario VARCHAR(100) NOT NULL,
    correo_asignado VARCHAR(150) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado ENUM('ACTIVO', 'RETIRADO') NOT NULL DEFAULT 'ACTIVO',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
);

-- DATOS INICIALES DE PRODUCCIÓN
INSERT INTO usuarios (username, password, nombre_completo, rol) VALUES
('admin', '123', 'Administrador TI', 'admin'),
('tecnico', '123', 'Tecnico TI', 'tech');
