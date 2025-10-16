import Head from "next/head";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function TermsAndConditions() {
  return (
    <>
      <Head>
        <title>Clinica Medica Sur | Terms and Conditions</title>
        <meta
          name="description"
          content="Read the Terms and Conditions for SymptomSync. Understand the rules and guidelines for using our app."
        />
      </Head>
      <motion.main
        className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-8 lg:px-16"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <style jsx global>{`
          html {
            scroll-behavior: smooth;
          }

          html,
          body {
            overscroll-behavior: none;
          }
        `}</style>
        <div className="max-w-4xl mx-auto">
          <motion.header className="mb-12 text-center" variants={slideInLeft}>
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
              Terms & Conditions
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Please read these terms and conditions carefully before using
              Clinica Medica Sur.
            </p>
          </motion.header>

          <motion.section className="space-y-8" variants={containerVariants}>
            <motion.article variants={fadeInUp}>
              <h2 className="text-2xl font-bold mb-4">Acceptance of Terms</h2>
              <p className="leading-7">  
              Al acceder y utilizar Clinica Medica Sur, usted acepta los términos y condiciones de este acuerdo. Si no acepta estos términos, le rogamos que no utilice nuestros servicios.
              </p>
            </motion.article>

            <motion.article variants={fadeInUp}>
              <h2 className="text-2xl font-bold mb-4">Changes to Terms</h2>
              <p className="leading-7">

              Nos reservamos el derecho de actualizar o modificar estos Términos y Condiciones en cualquier momento sin previo aviso. Cualquier cambio entrará en vigor inmediatamente después de su publicación en la Aplicación. Su uso continuado del servicio después de cualquier modificación de los Términos constituye su aceptación de los nuevos Términos.
              </p>
            </motion.article>

            <motion.article variants={fadeInUp}>
              <h2 className="text-2xl font-bold mb-4">User Responsibilities</h2>
              <p className="leading-7 mb-4">
               
              Al usar Clinica Medica Sur, usted se compromete a no participar en ninguna actividad que interfiera o interrumpa los servicios. Usted es responsable de todas las actividades que se realicen en su cuenta.
              </p>
              <ul className="list-disc ml-6 space-y-2">
                <li>
                  You agree to provide accurate, current, and complete
                  information during the registration process.
                </li>
                <li>
                  You must not use the App for any unlawful or fraudulent
                  purpose.
                </li>
                <li>
                  You are responsible for maintaining the confidentiality of
                  your account information.
                </li>
              </ul>
            </motion.article>

            <motion.article variants={fadeInUp}>
              <h2 className="text-2xl font-bold mb-4">Intellectual Property</h2>
              <p className="leading-7">

            Todo el contenido, las marcas comerciales y los datos de Clinica Medica Sur, incluyendo, entre otros, textos, gráficos, logotipos, iconos, imágenes y el software utilizado, son propiedad de Clinica Medica Sur o de sus licenciantes. El uso no autorizado de cualquier material puede infringir las leyes de derechos de autor.
              </p>
            </motion.article>

            <motion.article variants={fadeInUp}>
              <h2 className="text-2xl font-bold mb-4">
                Limitation of Liability
              </h2>
              <p className="leading-7">
              En ningún caso, Clinica Medica Sur, ni sus directores, empleados, socios, agentes, proveedores o afiliados serán responsables de ningún daño indirecto, incidental, especial, consecuente o punitivo que surja de su uso o de la imposibilidad de usar la Aplicación.
              </p>
            </motion.article>

            <motion.article variants={fadeInUp}>
              <h2 className="text-2xl font-bold mb-4">Governing Law</h2>
              <p className="leading-7">
                These Terms shall be governed and construed in accordance with
                the laws of the jurisdiction in which SymptomSync operates,
                without regard to its conflict of law provisions.
              </p>
            </motion.article>

            <motion.article variants={fadeInUp}>
              <h2 className="text-2xl font-bold mb-4">Contact Information</h2>
              <p className="leading-7">
                If you have any questions about these Terms and Conditions,
                please contact us at{" "}
                <a
                  href="mailto:support@symptomsync.com"
                  className="text-foreground underline"
                >
                  support@clinicamedicasur.com
                </a>
                .
              </p>
            </motion.article>
          </motion.section>
        </div>
      </motion.main>
    </>
  );
}
