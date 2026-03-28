# Gestion de Stock – Application Web

Ce projet est une application web de gestion de stock réalisée dans le cadre de mon projet de fin d’études en DUT Génie Informatique.
Elle permet de gérer les produits, les clients, les fournisseurs ainsi que les commandes.
---
## Objectif du projet
L’objectif est de faciliter la gestion des opérations commerciales en automatisant :
* la gestion du stock
* les ventes
* le suivi des clients et fournisseurs
---
## Fonctionnalités
* Authentification (connexion / inscription) 
* Gestion des produits (ajout, modification, suppression) 
* Gestion des clients 
* Gestion des fournisseurs 
* Panier et gestion des commandes  
* Génération de ticket après paiement
---
## Technologies utilisées
* HTML / CSS / JavaScript 
* PHP
* MySQL 
* XAMPP
---
## Structure du projet
```
gestion-stock/
│
├── index.html
├── style.css
├── app.js
│
├── api/
│   ├── auth.php
│   ├── products.php
│   ├── clients.php
│   ├── suppliers.php
│   ├── cart.php
│   ├── orders.php
│   └── config.php
```
---

## Installation
1. Télécharger ou cloner le projet
2. Le placer dans le dossier `htdocs` de XAMPP
3. Démarrer Apache et MySQL
4. Créer une base de données nommée `gestion_stock`
5. Lancer le projet via :
   [http://localhost/gestion-stock/](http://localhost/gestion-stock/)
## Auteur
Imane Chennoufi
## Remarque

Ce projet a été réalisé dans un objectif pédagogique pour mettre en pratique les notions de développement web (frontend + backend).

* ajouter une **partie UML (use case, classes)**
* ou écrire une **description parfaite pour ton CV GitHub** 👍
