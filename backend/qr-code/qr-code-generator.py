import os
import qrcode

# --- 1. Configuration du QR Code  ---
# PARAMS RECO : qr = qrcode.QRCode(version=1, 
#                                  error_correction=qrcode.constants.ERROR_CORRECT_L,
#                                  box_size=20,         
#                                  border=2,)
qr = qrcode.QRCode(
    version=1,           # Version 1 = Grille de 21x21 (le minimum)
    error_correction=qrcode.constants.ERROR_CORRECT_L, # Correction basse = moins de carrés
    box_size=20,         # Taille de chaque carré (augmente pour avoir de gros carrés)
    border=2            # Bordure blanche autour
)

# Ajout du lien
qr.add_data("https://the-budge.vercel.app/")
qr.make(fit=True)

# Création de l'image (Noir et Blanc pur)
img_qr = qr.make_image(fill_color="black", back_color="white")

# --- 2. Sauvegarder dans le dossier python avec gestion des doublons ---
target_folder = "backend\\qr-code"

# Créer le dossier s'il n'existe pas
if not os.path.exists(target_folder):
    os.makedirs(target_folder)

base_name = "TheBudge-qr-code"
extension = ".png"
filename = os.path.join(target_folder, f"{base_name}{extension}")
counter = 1

# Gestion des doublons (-1, -2, etc.)
while os.path.exists(filename):
    filename = os.path.join(target_folder, f"{base_name}-{counter}{extension}")
    counter += 1

# Sauvegarde finale
img_qr.save(filename)

print(f"QR Code simple généré : {filename}")