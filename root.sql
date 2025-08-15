-- phpMyAdmin SQL Dump
-- version 4.9.0.1
-- https://www.phpmyadmin.net/
--
-- Host: sql102.byetcluster.com
-- Creato il: Ago 15, 2025 alle 10:51
-- Versione del server: 11.4.7-MariaDB
-- Versione PHP: 7.2.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `if0_39665147_roomdate`
--

-- --------------------------------------------------------

--
-- Struttura della tabella `interactions`
--

CREATE TABLE `interactions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `target_id` int(11) NOT NULL,
  `action` enum('like','dislike') NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dump dei dati per la tabella `messages`
--

INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `message`, `created_at`) VALUES
(58, 2, 1, 'ciao', '2025-08-09 10:12:55'),
(59, 2, 1, 'ciao younesse sono felice di conoscerti', '2025-08-09 10:14:59'),
(60, 1, 2, 'EVVAI FUNZIONAAAA', '2025-08-09 10:15:19'),
(61, 5, 1, 'test', '2025-08-09 10:15:36'),
(62, 5, 1, 'test', '2025-08-09 10:16:30'),
(63, 5, 4, 'fb', '2025-08-09 10:17:17'),
(64, 6, 1, 'G', '2025-08-09 10:38:13'),
(65, 1, 6, 'bella bro', '2025-08-09 10:46:37'),
(66, 1, 6, 'show me your anaconda', '2025-08-09 10:46:45'),
(67, 6, 1, 'Bomboclat', '2025-08-09 10:47:35'),
(68, 3, 1, 'ciao', '2025-08-09 10:59:12'),
(69, 1, 3, 'ciao', '2025-08-09 10:59:28'),
(70, 1, 3, 'ciao', '2025-08-09 10:59:36'),
(71, 1, 3, 'ciao', '2025-08-09 11:00:50'),
(72, 7, 3, 'ciao Yeda', '2025-08-09 12:01:05'),
(73, 7, 1, 'cia Younesse', '2025-08-09 12:01:29'),
(74, 1, 7, 'hey baby', '2025-08-09 12:05:54'),
(75, 1, 7, 'show me your anaconda...', '2025-08-09 12:06:00'),
(76, 7, 1, 'i can&#039;t, too much gigabytes to conclude the upload ????', '2025-08-09 12:07:40'),
(77, 4, 5, 'okkk', '2025-08-09 13:20:28'),
(78, 8, 1, 'è strano', '2025-08-09 13:58:42'),
(79, 8, 1, 'non sto capendoci nulla', '2025-08-09 13:58:49'),
(80, 8, 1, 'te lo dico', '2025-08-09 13:58:51'),
(81, 1, 9, 'hey', '2025-08-09 16:43:53'),
(82, 11, 9, 'ciao amore', '2025-08-09 17:05:19'),
(83, 9, 11, 'CIAO', '2025-08-09 23:47:29'),
(84, 9, 1, 'HEY', '2025-08-09 23:48:23'),
(85, 9, 1, 'HEY', '2025-08-09 23:48:29'),
(86, 9, 1, 'HEY', '2025-08-09 23:48:30'),
(87, 9, 11, 'HEY', '2025-08-09 23:48:40'),
(88, 9, 1, 'HEY', '2025-08-09 23:48:52'),
(89, 9, 11, 'HEY', '2025-08-09 23:49:04'),
(90, 9, 11, 'HEY', '2025-08-09 23:50:29'),
(91, 9, 1, 'PIZZA', '2025-08-09 23:50:36'),
(92, 9, 11, 'ANANAS', '2025-08-09 23:50:48'),
(93, 11, 8, 'hey baby', '2025-08-09 23:54:55'),
(94, 9, 5, 'CIAO', '2025-08-10 10:03:42'),
(95, 1, 9, 'hey', '2025-08-10 10:15:54'),
(96, 9, 14, 'ciao', '2025-08-10 12:07:08'),
(97, 14, 9, 'ciao yedda', '2025-08-10 12:07:33'),
(98, 16, 5, 'oiiiiiiiiii', '2025-08-10 13:40:44'),
(99, 16, 5, 'oiiiiiiii', '2025-08-10 13:40:51'),
(100, 16, 9, 'oiiiiiii', '2025-08-10 13:41:03'),
(101, 9, 16, 'WELLA', '2025-08-10 13:41:30'),
(102, 1, 12, 'ciao mari', '2025-08-11 15:53:26'),
(103, 9, 1, 'hi', '2025-08-11 16:09:42'),
(104, 1, 14, 'ciao scarso', '2025-08-11 16:30:16'),
(105, 1, 14, '1vs1 scacchi', '2025-08-11 16:30:22'),
(106, 1, 14, 'ciao', '2025-08-12 15:33:22'),
(107, 1, 9, 'hey', '2025-08-12 15:34:13'),
(108, 9, 5, 'CIAO', '2025-08-13 11:20:02'),
(109, 9, 5, 'CIAO', '2025-08-13 11:34:47'),
(110, 20, 1, 'hi', '2025-08-14 11:18:34'),
(111, 1, 20, 'hi :)', '2025-08-14 13:58:30');

-- --------------------------------------------------------

--
-- Struttura della tabella `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `gender` varchar(1) NOT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `last_activity` datetime DEFAULT NULL,
  `chat_status` varchar(20) DEFAULT 'offline',
  `activity_count` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dump dei dati per la tabella `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `description`, `image_url`, `gender`, `is_online`, `last_activity`, `chat_status`, `activity_count`) VALUES
(1, 'younesseCEO', 'yeddassouli@gmail.com', '0e24ce75f7cdd081429430b7ae943b2423384915f0488530217adaa4d1f55ece', 'i’m the owner', 'images/uploads/img_689b2bf06c6505.93386730.jpeg', 'M', 0, '2025-08-15 06:12:16', 'offline', 974),
(3, 'Yedda', 'yeddamarocco@gmail.com', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'Ciao! Sono nuovo su Roomdate.', 'images/default.png', 'M', 0, NULL, 'offline', 0),
(5, 'test', 'test@example.com', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'Ciao! Sono nuovo su Roomdate.', 'images/default.png', 'M', 0, NULL, 'offline', 0),
(6, 'Stefano', 'stefanobonicelli05@gmail.com', '4982ea42b314302dde51877b648c3b27c8f758a876fb58baf18f403d409aa694', 'Ciao! Sono nuovo su Roomdate.', 'images/default.png', 'M', 0, NULL, 'offline', 0),
(7, 'Luiz', 'luiztravasso05@gmail.com', '3abfa8bc45da0463a936d3226dc036016153d9872c4a24126ab61b1b31b9a364', 'Ciao! Sono nuovo su Roomdate.', 'images/default.png', 'M', 0, NULL, 'offline', 0),
(8, 'Elisa Moi', '07elisamoi20@gmail.com', '0971b2dcf72912dc90d6d84278e3e9171007465b81cfb437ab6475d8d906a55b', 'Ciao! Sono nuovo su Roomdate.', 'images/default.png', 'F', 0, NULL, 'offline', 0),
(9, 'prova123', 'prova@gmail.com', 'ffc37a16b4a22c546d7b99f129ce0894a65fb32fbd4c13f331ad3237a238c424', 'sono una prova vivente', 'images/uploads/img_689b21b54a82d3.90099965.jpg', 'F', 1, '2025-08-15 06:36:36', 'online', 4265),
(11, 'jacopo', 'jacopo@gmail.com', '403afa5071a472775fa1bd0b1d6aaca83efa99bf55d11e30f1f672189e151469', 'Ciao! Sono nuovo su Roomdate.', 'images/uploads/img_68977fa71de118.65909033.png', 'M', 0, '2025-08-12 13:02:21', 'offline', 1667),
(12, 'Marianna', 'marianna@gmail.com', '2458613632156f1491ba968aba253e4489041f86cd20c94839c6e1f57bc8c12f', 'sono una donna e cucino', 'images/uploads/img_6897d8f9a690b9.26645961.jpg', 'F', 0, NULL, 'offline', 0),
(13, 'funza', 'funza@a.com', '15753d0310813ec0927e835b54797fb5ea4cf085e692df0b1f9255bd50e71d8a', 'aaa', 'images/uploads/img_6897e4efac5d81.38213962.jpg', 'M', 0, '2025-08-09 17:17:29', 'offline', 0),
(14, 'Kareem', 'kareem@gmail.com', '674552ada3820f7733c110827306af1bd4d2df14a79dd28ced5f41031fc520ad', 'gioco a scacchi', 'images/uploads/img_68988b15e853f2.31571005.png', 'M', 0, '2025-08-13 04:38:51', 'offline', 0),
(15, 'Aicha senhaji', '69aicha@gmail.com', '2a9277e374ead72d70de60f157f6f38349d346709bcd043075fa39ddf2fa64a5', 'Sono ordinata', 'images/uploads/img_689897b94188c7.29447362.jpg', 'F', 0, '2025-08-11 09:11:25', 'offline', 0),
(16, 'hu haide', 'huhaide0530@gmail.com', '2c5cfffce75fecce52095a384414f3aabf29b2fa6d625f958426a9ae03bad83f', 'sono cinese', 'images/uploads/img_6898a131428288.55903228.jpg', 'M', 0, '2025-08-10 07:02:07', 'offline', 0),
(18, 'Sofia', 'sogiblu01@gmail.com', '06bc96f3adb5b73156d88ec4a329820a59b6f51cc8303ca13c542ef67424c206', '', 'images/uploads/img_689b6bbd4f9c70.41022253.jpeg', 'F', 0, '2025-08-12 10:09:15', 'offline', 0),
(19, 'Morgan Casamassima', 'morganzero11@gmail.com', '0c5395b838c350d79bfd41639179fdb72e2111f0fee096d03197c75d1fb605b4', 'Mi piacciono gli anime.', 'images/uploads/img_689b85cd44ca36.50062662.jpg', 'M', 0, '2025-08-12 11:20:10', 'offline', 0),
(20, 'brian kathurima', 'kbrian1237@gmail.com', '80ce4c5cb6318a21b8c460b85054a2091a33624aa113bca0c15f1208da5df766', 'im a computer scientist', 'images/uploads/img_689dc5b58a0b85.92666250.jpg', 'M', 0, '2025-08-14 04:18:53', 'offline', 0);

-- --------------------------------------------------------

--
-- Struttura della tabella `user_activity`
--

CREATE TABLE `user_activity` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `activity_time` datetime NOT NULL,
  `activity_type` enum('login','logout','active','idle') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `device_info` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dump dei dati per la tabella `user_activity`
--

INSERT INTO `user_activity` (`id`, `user_id`, `activity_time`, `activity_type`, `ip_address`, `device_info`) VALUES
(1, 13, '2025-08-09 17:17:57', 'logout', NULL, NULL),
(2, 9, '2025-08-09 17:19:40', 'logout', NULL, NULL),
(3, 1, '2025-08-09 17:20:11', 'logout', NULL, NULL),
(4, 9, '2025-08-09 17:25:48', 'logout', NULL, NULL),
(5, 9, '2025-08-09 17:26:06', 'logout', NULL, NULL),
(6, 9, '2025-08-09 17:26:06', 'logout', NULL, NULL),
(7, 9, '2025-08-09 17:26:40', 'logout', NULL, NULL),
(8, 9, '2025-08-09 17:27:08', 'logout', NULL, NULL),
(9, 9, '2025-08-09 17:28:27', 'logout', NULL, NULL),
(10, 9, '2025-08-09 17:28:27', 'logout', NULL, NULL),
(11, 1, '2025-08-09 17:33:28', 'logout', NULL, NULL),
(12, 1, '2025-08-09 17:33:30', 'logout', NULL, NULL),
(13, 1, '2025-08-09 17:33:32', 'logout', NULL, NULL),
(14, 1, '2025-08-09 17:34:27', 'logout', NULL, NULL),
(15, 1, '2025-08-09 17:35:17', 'logout', NULL, NULL),
(16, 1, '2025-08-09 17:35:18', 'logout', NULL, NULL),
(17, 1, '2025-08-09 17:35:18', 'logout', NULL, NULL),
(18, 1, '2025-08-09 17:35:31', 'logout', NULL, NULL),
(19, 1, '2025-08-09 17:35:46', 'logout', NULL, NULL),
(20, 1, '2025-08-09 17:35:58', 'logout', NULL, NULL),
(21, 1, '2025-08-09 17:35:58', 'logout', NULL, NULL),
(22, 11, '2025-08-09 17:36:01', 'logout', NULL, NULL),
(23, 9, '2025-08-10 03:04:28', 'logout', NULL, NULL),
(24, 9, '2025-08-10 03:04:37', 'logout', NULL, NULL),
(25, 9, '2025-08-10 03:04:37', 'logout', NULL, NULL),
(26, 9, '2025-08-10 03:06:20', 'logout', NULL, NULL),
(27, 9, '2025-08-10 03:06:48', 'logout', NULL, NULL),
(28, 9, '2025-08-10 03:06:50', 'logout', NULL, NULL),
(29, 9, '2025-08-10 03:06:50', 'logout', NULL, NULL),
(30, 9, '2025-08-10 03:08:01', 'logout', NULL, NULL),
(31, 9, '2025-08-10 03:08:04', 'logout', NULL, NULL),
(32, 9, '2025-08-10 03:13:56', 'logout', NULL, NULL),
(33, 9, '2025-08-10 03:15:30', 'logout', NULL, NULL),
(34, 1, '2025-08-10 03:18:25', 'logout', NULL, NULL),
(35, 9, '2025-08-10 03:33:26', 'logout', NULL, NULL),
(36, 9, '2025-08-10 03:33:43', 'logout', NULL, NULL),
(37, 9, '2025-08-10 03:34:08', 'logout', NULL, NULL),
(38, 9, '2025-08-10 03:34:15', 'logout', NULL, NULL),
(39, 1, '2025-08-10 03:34:39', 'logout', NULL, NULL),
(40, 1, '2025-08-10 03:35:17', 'logout', NULL, NULL),
(41, 9, '2025-08-10 03:35:42', 'logout', NULL, NULL),
(42, 9, '2025-08-10 03:35:43', 'logout', NULL, NULL),
(43, 9, '2025-08-10 03:35:45', 'logout', NULL, NULL),
(44, 9, '2025-08-10 03:35:49', 'logout', NULL, NULL),
(45, 9, '2025-08-10 03:35:50', 'logout', NULL, NULL),
(46, 9, '2025-08-10 03:35:51', 'logout', NULL, NULL),
(47, 9, '2025-08-10 03:35:52', 'logout', NULL, NULL),
(48, 9, '2025-08-10 03:35:52', 'logout', NULL, NULL),
(49, 9, '2025-08-10 03:35:53', 'logout', NULL, NULL),
(50, 9, '2025-08-10 03:35:53', 'logout', NULL, NULL),
(51, 9, '2025-08-10 03:35:54', 'logout', NULL, NULL),
(52, 9, '2025-08-10 03:35:54', 'logout', NULL, NULL),
(53, 9, '2025-08-10 03:36:02', 'logout', NULL, NULL),
(54, 9, '2025-08-10 03:36:03', 'logout', NULL, NULL),
(55, 9, '2025-08-10 03:36:04', 'logout', NULL, NULL),
(56, 9, '2025-08-10 03:36:05', 'logout', NULL, NULL),
(57, 9, '2025-08-10 03:36:07', 'logout', NULL, NULL),
(58, 9, '2025-08-10 03:36:08', 'logout', NULL, NULL),
(59, 9, '2025-08-10 03:36:09', 'logout', NULL, NULL),
(60, 9, '2025-08-10 03:36:10', 'logout', NULL, NULL),
(61, 9, '2025-08-10 03:36:11', 'logout', NULL, NULL),
(62, 9, '2025-08-10 03:36:11', 'logout', NULL, NULL),
(63, 9, '2025-08-10 03:36:12', 'logout', NULL, NULL),
(64, 9, '2025-08-10 03:36:13', 'logout', NULL, NULL),
(65, 9, '2025-08-10 03:36:14', 'logout', NULL, NULL),
(66, 9, '2025-08-10 03:36:19', 'logout', NULL, NULL),
(67, 9, '2025-08-10 03:36:23', 'logout', NULL, NULL),
(68, 9, '2025-08-10 03:37:18', 'logout', NULL, NULL),
(69, 9, '2025-08-10 03:37:26', 'logout', NULL, NULL),
(70, 9, '2025-08-10 03:37:41', 'logout', NULL, NULL),
(71, 9, '2025-08-10 03:37:49', 'logout', NULL, NULL),
(72, 9, '2025-08-10 03:37:54', 'logout', NULL, NULL),
(73, 9, '2025-08-10 03:37:58', 'logout', NULL, NULL),
(74, 9, '2025-08-10 03:37:59', 'logout', NULL, NULL),
(75, 9, '2025-08-10 03:38:03', 'logout', NULL, NULL),
(76, 9, '2025-08-10 03:38:04', 'logout', NULL, NULL),
(77, 9, '2025-08-10 03:38:05', 'logout', NULL, NULL),
(78, 9, '2025-08-10 03:38:07', 'logout', NULL, NULL),
(79, 9, '2025-08-10 03:38:13', 'logout', NULL, NULL),
(80, 9, '2025-08-10 03:38:14', 'logout', NULL, NULL),
(81, 9, '2025-08-10 03:38:15', 'logout', NULL, NULL),
(82, 9, '2025-08-10 03:38:16', 'logout', NULL, NULL),
(83, 9, '2025-08-10 03:38:27', 'logout', NULL, NULL),
(84, 9, '2025-08-10 03:38:28', 'logout', NULL, NULL),
(85, 9, '2025-08-10 03:38:29', 'logout', NULL, NULL),
(86, 9, '2025-08-10 03:38:29', 'logout', NULL, NULL),
(87, 9, '2025-08-10 03:38:30', 'logout', NULL, NULL),
(88, 9, '2025-08-10 03:38:30', 'logout', NULL, NULL),
(89, 9, '2025-08-10 03:38:30', 'logout', NULL, NULL),
(90, 9, '2025-08-10 03:38:31', 'logout', NULL, NULL),
(91, 9, '2025-08-10 03:38:31', 'logout', NULL, NULL),
(92, 9, '2025-08-10 03:38:31', 'logout', NULL, NULL),
(93, 9, '2025-08-10 03:38:37', 'logout', NULL, NULL),
(94, 9, '2025-08-10 03:38:38', 'logout', NULL, NULL),
(95, 9, '2025-08-10 03:38:39', 'logout', NULL, NULL),
(96, 9, '2025-08-10 03:38:40', 'logout', NULL, NULL),
(97, 9, '2025-08-10 03:38:40', 'logout', NULL, NULL),
(98, 9, '2025-08-10 03:38:41', 'logout', NULL, NULL),
(99, 9, '2025-08-10 03:38:41', 'logout', NULL, NULL),
(100, 9, '2025-08-10 03:38:42', 'logout', NULL, NULL),
(101, 9, '2025-08-10 03:38:42', 'logout', NULL, NULL),
(102, 9, '2025-08-10 03:38:43', 'logout', NULL, NULL),
(103, 9, '2025-08-10 03:38:43', 'logout', NULL, NULL),
(104, 9, '2025-08-10 03:38:44', 'logout', NULL, NULL),
(105, 9, '2025-08-10 03:38:44', 'logout', NULL, NULL),
(106, 9, '2025-08-10 03:38:44', 'logout', NULL, NULL),
(107, 9, '2025-08-10 03:38:45', 'logout', NULL, NULL),
(108, 9, '2025-08-10 03:38:45', 'logout', NULL, NULL),
(109, 9, '2025-08-10 03:38:46', 'logout', NULL, NULL),
(110, 9, '2025-08-10 03:38:46', 'logout', NULL, NULL),
(111, 9, '2025-08-10 03:38:47', 'logout', NULL, NULL),
(112, 9, '2025-08-10 03:38:47', 'logout', NULL, NULL),
(113, 9, '2025-08-10 03:38:47', 'logout', NULL, NULL),
(114, 9, '2025-08-10 03:38:48', 'logout', NULL, NULL),
(115, 9, '2025-08-10 03:38:48', 'logout', NULL, NULL),
(116, 9, '2025-08-10 03:38:49', 'logout', NULL, NULL),
(117, 9, '2025-08-10 03:38:49', 'logout', NULL, NULL),
(118, 9, '2025-08-10 03:38:50', 'logout', NULL, NULL),
(119, 9, '2025-08-10 03:38:50', 'logout', NULL, NULL),
(120, 9, '2025-08-10 03:38:50', 'logout', NULL, NULL),
(121, 9, '2025-08-10 03:38:50', 'logout', NULL, NULL),
(122, 9, '2025-08-10 03:38:51', 'logout', NULL, NULL),
(123, 9, '2025-08-10 03:38:51', 'logout', NULL, NULL),
(124, 9, '2025-08-10 03:38:51', 'logout', NULL, NULL),
(125, 9, '2025-08-10 03:38:51', 'logout', NULL, NULL),
(126, 9, '2025-08-10 03:38:52', 'logout', NULL, NULL),
(127, 9, '2025-08-10 03:38:52', 'logout', NULL, NULL),
(128, 9, '2025-08-10 03:38:52', 'logout', NULL, NULL),
(129, 9, '2025-08-10 03:38:52', 'logout', NULL, NULL),
(130, 9, '2025-08-10 03:38:52', 'logout', NULL, NULL),
(131, 9, '2025-08-10 03:38:53', 'logout', NULL, NULL),
(132, 9, '2025-08-10 03:38:53', 'logout', NULL, NULL),
(133, 9, '2025-08-10 03:38:53', 'logout', NULL, NULL),
(134, 9, '2025-08-10 03:38:53', 'logout', NULL, NULL),
(135, 9, '2025-08-10 03:38:53', 'logout', NULL, NULL),
(136, 9, '2025-08-10 03:38:54', 'logout', NULL, NULL),
(137, 9, '2025-08-10 03:38:54', 'logout', NULL, NULL),
(138, 9, '2025-08-10 03:38:54', 'logout', NULL, NULL),
(139, 9, '2025-08-10 03:38:54', 'logout', NULL, NULL),
(140, 9, '2025-08-10 03:38:54', 'logout', NULL, NULL),
(141, 9, '2025-08-10 03:38:55', 'logout', NULL, NULL),
(142, 9, '2025-08-10 03:38:55', 'logout', NULL, NULL),
(143, 9, '2025-08-10 03:38:58', 'logout', NULL, NULL),
(144, 9, '2025-08-10 03:39:01', 'logout', NULL, NULL),
(145, 9, '2025-08-10 03:39:03', 'logout', NULL, NULL),
(146, 9, '2025-08-10 03:39:04', 'logout', NULL, NULL),
(147, 9, '2025-08-10 03:39:16', 'logout', NULL, NULL),
(148, 9, '2025-08-10 03:39:23', 'logout', NULL, NULL),
(149, 9, '2025-08-10 03:39:26', 'logout', NULL, NULL),
(150, 9, '2025-08-10 03:39:27', 'logout', NULL, NULL),
(151, 9, '2025-08-10 03:39:27', 'logout', NULL, NULL),
(152, 9, '2025-08-10 03:39:28', 'logout', NULL, NULL),
(153, 9, '2025-08-10 03:39:28', 'logout', NULL, NULL),
(154, 9, '2025-08-10 03:39:28', 'logout', NULL, NULL),
(155, 9, '2025-08-10 03:39:29', 'logout', NULL, NULL),
(156, 9, '2025-08-10 03:39:29', 'logout', NULL, NULL),
(157, 9, '2025-08-10 03:39:29', 'logout', NULL, NULL),
(158, 9, '2025-08-10 03:39:29', 'logout', NULL, NULL),
(159, 9, '2025-08-10 03:39:29', 'logout', NULL, NULL),
(160, 9, '2025-08-10 03:39:30', 'logout', NULL, NULL),
(161, 9, '2025-08-10 03:39:30', 'logout', NULL, NULL),
(162, 9, '2025-08-10 03:39:30', 'logout', NULL, NULL),
(163, 9, '2025-08-10 03:39:30', 'logout', NULL, NULL),
(164, 9, '2025-08-10 03:39:31', 'logout', NULL, NULL),
(165, 9, '2025-08-10 03:39:31', 'logout', NULL, NULL),
(166, 9, '2025-08-10 03:39:31', 'logout', NULL, NULL),
(167, 9, '2025-08-10 03:39:31', 'logout', NULL, NULL),
(168, 9, '2025-08-10 03:40:00', 'logout', NULL, NULL),
(169, 9, '2025-08-10 03:41:16', 'logout', NULL, NULL),
(170, 9, '2025-08-10 03:41:17', 'logout', NULL, NULL),
(171, 9, '2025-08-10 03:41:17', 'logout', NULL, NULL),
(172, 9, '2025-08-10 03:41:18', 'logout', NULL, NULL),
(173, 9, '2025-08-10 03:41:37', 'logout', NULL, NULL),
(174, 9, '2025-08-10 03:41:52', 'logout', NULL, NULL),
(175, 9, '2025-08-10 03:41:53', 'logout', NULL, NULL),
(176, 9, '2025-08-10 03:41:54', 'logout', NULL, NULL),
(177, 9, '2025-08-10 03:42:00', 'logout', NULL, NULL),
(178, 9, '2025-08-10 03:42:01', 'logout', NULL, NULL),
(179, 9, '2025-08-10 03:42:02', 'logout', NULL, NULL),
(180, 9, '2025-08-10 03:42:02', 'logout', NULL, NULL),
(181, 9, '2025-08-10 03:42:03', 'logout', NULL, NULL),
(182, 9, '2025-08-10 03:42:03', 'logout', NULL, NULL),
(183, 9, '2025-08-10 03:42:04', 'logout', NULL, NULL),
(184, 9, '2025-08-10 03:42:36', 'logout', NULL, NULL),
(185, 9, '2025-08-10 03:42:38', 'logout', NULL, NULL),
(186, 9, '2025-08-10 03:42:39', 'logout', NULL, NULL),
(187, 9, '2025-08-10 03:42:39', 'logout', NULL, NULL),
(188, 9, '2025-08-10 03:42:40', 'logout', NULL, NULL),
(189, 9, '2025-08-10 03:42:40', 'logout', NULL, NULL),
(190, 9, '2025-08-10 03:42:46', 'logout', NULL, NULL),
(191, 9, '2025-08-10 03:47:39', 'logout', NULL, NULL);

-- --------------------------------------------------------

--
-- Struttura della tabella `user_relationships`
--

CREATE TABLE `user_relationships` (
  `user_id` int(11) NOT NULL,
  `related_user_id` int(11) NOT NULL,
  `relationship_type` enum('friend','blocked','pending') NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Indici per le tabelle scaricate
--

--
-- Indici per le tabelle `interactions`
--
ALTER TABLE `interactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `target_id` (`target_id`);

--
-- Indici per le tabelle `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_last_activity` (`last_activity`),
  ADD KEY `idx_is_online` (`is_online`),
  ADD KEY `idx_chat_status` (`chat_status`);

--
-- Indici per le tabelle `user_activity`
--
ALTER TABLE `user_activity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_activity` (`user_id`,`activity_time`),
  ADD KEY `idx_activity_type` (`activity_type`);

--
-- Indici per le tabelle `user_relationships`
--
ALTER TABLE `user_relationships`
  ADD PRIMARY KEY (`user_id`,`related_user_id`),
  ADD KEY `related_user_id` (`related_user_id`);

--
-- AUTO_INCREMENT per le tabelle scaricate
--

--
-- AUTO_INCREMENT per la tabella `interactions`
--
ALTER TABLE `interactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=99;

--
-- AUTO_INCREMENT per la tabella `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=112;

--
-- AUTO_INCREMENT per la tabella `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT per la tabella `user_activity`
--
ALTER TABLE `user_activity`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=192;

--
-- Limiti per le tabelle scaricate
--

--
-- Limiti per la tabella `user_activity`
--
ALTER TABLE `user_activity`
  ADD CONSTRAINT `user_activity_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Limiti per la tabella `user_relationships`
--
ALTER TABLE `user_relationships`
  ADD CONSTRAINT `user_relationships_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_relationships_ibfk_2` FOREIGN KEY (`related_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
