from flask import Flask, render_template, request, redirect, url_for, flash
from datetime import date, datetime
from models import db, House, Reservation

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///reservations.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = "change-me-in-production"

db.init_app(app)


def seed_houses():
    if House.query.count() > 0:
        return
    houses = [
        House(
            name="Ocean View Cottage",
            description="A charming beachfront cottage with stunning ocean views, perfect for a relaxing getaway. Enjoy the sound of waves from your private deck.",
            location="Malibu, California",
            price_per_night=250.00,
            max_guests=4,
            bedrooms=2,
            bathrooms=1,
        ),
        House(
            name="Mountain Retreat",
            description="Cozy cabin nestled in the mountains with panoramic views, hiking trails nearby, and a wood-burning fireplace for cool evenings.",
            location="Aspen, Colorado",
            price_per_night=320.00,
            max_guests=6,
            bedrooms=3,
            bathrooms=2,
        ),
        House(
            name="City Loft",
            description="Modern downtown loft in the heart of the city. Walking distance to restaurants, museums, and entertainment. Rooftop terrace included.",
            location="New York City, New York",
            price_per_night=180.00,
            max_guests=2,
            bedrooms=1,
            bathrooms=1,
        ),
        House(
            name="Lakeside Villa",
            description="Luxurious villa on the shores of a pristine lake. Private dock, kayaks included, and a fully equipped kitchen for extended stays.",
            location="Lake Tahoe, Nevada",
            price_per_night=450.00,
            max_guests=8,
            bedrooms=4,
            bathrooms=3,
        ),
        House(
            name="Desert Oasis",
            description="Stunning adobe-style home surrounded by red rock formations. Private pool, outdoor firepit, and breathtaking sunset views every evening.",
            location="Sedona, Arizona",
            price_per_night=290.00,
            max_guests=5,
            bedrooms=3,
            bathrooms=2,
        ),
    ]
    db.session.add_all(houses)
    db.session.commit()


@app.before_request
def create_tables():
    db.create_all()
    seed_houses()


@app.route("/")
def index():
    featured = House.query.limit(3).all()
    return render_template("index.html", houses=featured)


@app.route("/houses")
def houses():
    all_houses = House.query.all()
    return render_template("houses.html", houses=all_houses)


@app.route("/houses/<int:house_id>")
def house_detail(house_id):
    house = House.query.get_or_404(house_id)
    today = date.today().isoformat()
    return render_template("house_detail.html", house=house, today=today)


@app.route("/houses/<int:house_id>/reserve", methods=["GET", "POST"])
def reserve(house_id):
    house = House.query.get_or_404(house_id)
    today = date.today().isoformat()

    if request.method == "POST":
        guest_name = request.form.get("guest_name", "").strip()
        guest_email = request.form.get("guest_email", "").strip()
        check_in_str = request.form.get("check_in", "")
        check_out_str = request.form.get("check_out", "")
        num_guests = request.form.get("num_guests", "1")

        errors = []
        if not guest_name:
            errors.append("Name is required.")
        if not guest_email or "@" not in guest_email:
            errors.append("A valid email is required.")
        try:
            check_in = datetime.strptime(check_in_str, "%Y-%m-%d").date()
            check_out = datetime.strptime(check_out_str, "%Y-%m-%d").date()
        except ValueError:
            errors.append("Invalid dates provided.")
            check_in = check_out = None

        if check_in and check_out:
            if check_in < date.today():
                errors.append("Check-in date cannot be in the past.")
            if check_out <= check_in:
                errors.append("Check-out must be after check-in.")
            else:
                try:
                    num_guests = int(num_guests)
                except ValueError:
                    num_guests = 1
                if num_guests < 1 or num_guests > house.max_guests:
                    errors.append(f"Guests must be between 1 and {house.max_guests}.")
                if not house.is_available(check_in, check_out):
                    errors.append("House is not available for the selected dates.")

        if errors:
            for error in errors:
                flash(error, "error")
            return render_template(
                "reserve.html",
                house=house,
                today=today,
                form=request.form,
            )

        nights = (check_out - check_in).days
        total_price = nights * house.price_per_night
        reservation = Reservation(
            house_id=house.id,
            guest_name=guest_name,
            guest_email=guest_email,
            check_in=check_in,
            check_out=check_out,
            num_guests=num_guests,
            total_price=total_price,
        )
        db.session.add(reservation)
        db.session.commit()
        flash(f"Reservation confirmed! Confirmation #RES{reservation.id:04d}", "success")
        return redirect(url_for("reservation_detail", reservation_id=reservation.id))

    return render_template("reserve.html", house=house, today=today, form={})


@app.route("/reservations")
def reservations():
    all_reservations = Reservation.query.order_by(Reservation.created_at.desc()).all()
    return render_template("reservations.html", reservations=all_reservations)


@app.route("/reservations/<int:reservation_id>")
def reservation_detail(reservation_id):
    reservation = Reservation.query.get_or_404(reservation_id)
    return render_template("reservation_detail.html", reservation=reservation)


if __name__ == "__main__":
    app.run(debug=True)
